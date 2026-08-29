import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Every other SDK test in this suite imports `src/sdk/index.js` via a
 * relative path, which proves the internal module graph resolves but
 * proves NOTHING about `package.json`'s `exports` field — a consumer who
 * actually runs `npm install codeagent` and writes
 * `import { Orchestrator } from "codeagent/sdk"` is going through a
 * completely different resolution path (Node's package-exports
 * algorithm, the `files` allowlist deciding what's actually in the
 * published tarball) that a relative-import test cannot exercise at all.
 *
 * `npm pack` specifically (not just `npm install <local-path>`) is used
 * because it round-trips through the exact same `files` field an actual
 * `npm publish` would use — installing the raw source directory would
 * silently work even if `files` were missing something the SDK needs,
 * masking a real packaging bug until a real user hit it after publish.
 */
describe("SDK packaging (npm pack -> install -> import, real subprocess)", () => {
  let consumerDir;
  let tarballPath;

  beforeAll(() => {
    consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-sdk-consumer-"));
    fs.writeFileSync(path.join(consumerDir, "package.json"), JSON.stringify({ name: "sdk-consumer-test", type: "module" }));

    const packOutput = execFileSync("npm", ["pack", "--json", REPO_ROOT], { cwd: consumerDir, encoding: "utf-8" });
    const [{ filename }] = JSON.parse(packOutput);
    tarballPath = path.join(consumerDir, filename);

    execFileSync("npm", ["install", "--no-audit", "--no-fund", tarballPath], { cwd: consumerDir, stdio: "pipe" });
  }, 60_000);

  afterAll(() => {
    if (consumerDir) fs.rmSync(consumerDir, { recursive: true, force: true });
  });

  function runInConsumer(script) {
    const scriptPath = path.join(consumerDir, "_test-script.mjs");
    fs.writeFileSync(scriptPath, script);
    const output = execFileSync("node", [scriptPath], { cwd: consumerDir, encoding: "utf-8" });
    fs.rmSync(scriptPath);
    return output;
  }

  it("imports core classes from the codeagent/sdk subpath", () => {
    const output = runInConsumer(`
      import { Orchestrator, ToolRegistry, SDK_VERSION } from "codeagent/sdk";
      console.log(JSON.stringify({
        hasOrchestrator: typeof Orchestrator === "function",
        hasToolRegistry: typeof ToolRegistry === "function",
        version: SDK_VERSION,
      }));
    `);
    expect(JSON.parse(output)).toEqual({ hasOrchestrator: true, hasToolRegistry: true, version: "1.0.0" });
  });

  it("rejects a bare 'codeagent' import with no subpath — forces the explicit, documented entry point", () => {
    const output = runInConsumer(`
      try {
        await import("codeagent");
        console.log("UNEXPECTED_SUCCESS");
      } catch (err) {
        console.log(err.code);
      }
    `);
    expect(output.trim()).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
  });

  it("runs a full Orchestrator turn end-to-end using only the packaged SDK, no CLI code involved", () => {
    const output = runInConsumer(`
      import { Orchestrator, ToolRegistry } from "codeagent/sdk";

      const fakeProvider = {
        async send() {
          return { content: [{ type: "text", text: "Hello from the packaged SDK!" }], usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn" };
        },
        countTokens() { return 1; },
      };

      const orchestrator = new Orchestrator({
        provider: fakeProvider,
        toolRegistry: new ToolRegistry([]),
        confirm: async () => ({ allowed: true }),
        config: { maxIterationsPerTurn: 5 },
      });

      const result = await orchestrator.runTurn({
        messages: [],
        userInput: "hi",
        system: "sys",
        cwd: process.cwd(),
      });

      console.log(result.history.at(-1).content[0].text);
    `);
    expect(output.trim()).toBe("Hello from the packaged SDK!");
  });

  it("createDefaultRegistry() from the packaged SDK includes every built-in tool", () => {
    const output = runInConsumer(`
      import { createDefaultRegistry } from "codeagent/sdk";
      const registry = createDefaultRegistry();
      console.log(registry.list().map((t) => t.name).sort().join(","));
    `);
    expect(output.trim().split(",")).toEqual(expect.arrayContaining(["read_file", "write_file", "edit_file", "run_bash"]));
  });
});
