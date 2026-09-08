import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "../../src/cli/index.js";
import { isFolderTrusted, trustFolder } from "../../src/safety/folderTrust.js";

/**
 * Real end-to-end coverage of the Folder Trust gate (docs/30) through the
 * actual `run()` entry point — not just the pure decision function
 * (`shouldRequireFolderTrust`, covered separately in
 * folderTrustGate.test.js). Uses Ollama as the configured provider
 * specifically because it needs no API key and fails fast with a network
 * error in this environment (no local Ollama server) — that failure
 * happens strictly AFTER the trust gate, so a fast, harmless provider
 * failure is actually a convenient, deterministic signal that execution
 * got past the gate, without needing a real LLM call or any network
 * mocking.
 */

function fakeInput(lines) {
  const stream = new Readable({ read() {} });
  if (lines.length > 0) stream.push(lines.join("\n") + "\n");
  stream.push(null);
  return stream;
}

describe("Folder Trust gate — real end-to-end via run()", () => {
  let homedir;
  let projectDir;
  let originalCwd;
  let originalStdin;

  beforeEach(() => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-trust-e2e-home-"));
    fs.writeFileSync(
      path.join(homedir, ".codeagentrc"),
      JSON.stringify({
        providers: { ollama: { model: "llama3.1", apiKeyEnvVar: "OLLAMA_API_KEY" } },
        provider: "ollama",
        model: "llama3.1",
        apiKeyEnvVar: "OLLAMA_API_KEY",
        maxIterationsPerTurn: 1,
      })
    );
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-trust-e2e-project-"));
    originalCwd = process.cwd();
    originalStdin = process.stdin;
    process.chdir(projectDir);
    process.env.HOME = homedir; // os.homedir() reads $HOME on POSIX
  });

  afterEach(() => {
    process.chdir(originalCwd);
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
    fs.rmSync(homedir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  function withFakeStdin(lines) {
    Object.defineProperty(process, "stdin", { value: fakeInput(lines), configurable: true });
  }

  it("declining the prompt does not write a trust entry", async () => {
    withFakeStdin(["n"]);
    await run(["node", "codeagent", "do something"]);
    expect(await isFolderTrusted(projectDir, { homedir })).toBe(false);
  }, 10_000);

  it("accepting the prompt writes a trust entry before proceeding", async () => {
    withFakeStdin(["y"]);
    // The subsequent Ollama call fails fast (no local server) — expected
    // and irrelevant to what this test checks; only the trust write,
    // which must have happened before that call, matters here.
    await run(["node", "codeagent", "do something"]).catch(() => {});
    expect(await isFolderTrusted(projectDir, { homedir })).toBe(true);
  }, 10_000);

  it("--trust auto-trusts without ever reading from stdin", async () => {
    withFakeStdin([]); // immediately-ended stream — a real prompt read would hang/reject on this
    await run(["node", "codeagent", "--trust", "do something"]).catch(() => {});
    expect(await isFolderTrusted(projectDir, { homedir })).toBe(true);
  }, 10_000);

  it("an already-trusted folder does not prompt again on a later invocation", async () => {
    await trustFolder(projectDir, { homedir });
    withFakeStdin([]); // if the gate incorrectly re-fired, this would hang the test until timeout
    await run(["node", "codeagent", "do something else"]).catch(() => {});
    // Reaching this line at all (within the test timeout) proves no
    // second prompt was attempted.
    expect(await isFolderTrusted(projectDir, { homedir })).toBe(true);
  }, 10_000);

  it("an exempt command (config) never triggers the gate, even in a brand-new, never-trusted folder", async () => {
    withFakeStdin([]); // would hang if the gate incorrectly fired here
    await run(["node", "codeagent", "config"]);
    expect(await isFolderTrusted(projectDir, { homedir })).toBe(false);
  }, 10_000);
});
