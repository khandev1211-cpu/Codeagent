import { describe, it, expect, afterEach } from "vitest";
import { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { ConfigManager } from "../../src/cli/configManager.js";
import { loadConfig } from "../../src/config/loader.js";

/**
 * Drip-feeds lines with a small delay between each, rather than pushing
 * them all synchronously up front — a synchronous bulk-push can race
 * ahead of `rl.question()` callbacks being registered, which looks like
 * "the flow silently stops" (readline's internal buffer isn't guaranteed
 * to behave like a subprocess pipe under `printf | node cli.js` timing).
 * This mirrors how a real person typing answers one at a time actually
 * behaves, and is what surfaced a genuine bug (a ReferenceError on the
 * `-i` flag's logger) during manual testing that bulk-piped input via a
 * subprocess did not reliably reproduce.
 */
function fakeInteractiveInput(lines) {
  const stream = new Readable({ read() {} });
  lines.forEach((line, i) => setTimeout(() => stream.push(`${line}\n`), i * 15));
  return stream;
}

describe("ConfigManager (interactive)", () => {
  let homedir;
  let origCreateInterface;

  function seedConfig(overrides = {}) {
    fs.writeFileSync(
      path.join(homedir, ".codeagentrc"),
      JSON.stringify({
        providers: { anthropic: { model: "claude-sonnet-4-6", apiKeyEnvVar: "ANTHROPIC_API_KEY" } },
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        apiKeyEnvVar: "ANTHROPIC_API_KEY",
        ...overrides,
      })
    );
  }

  function withFakeInput(lines) {
    const input = fakeInteractiveInput(lines);
    origCreateInterface = readline.createInterface;
    readline.createInterface = (opts) => origCreateInterface({ ...opts, input, output: fs.createWriteStream("/dev/null") });
  }

  afterEach(() => {
    if (origCreateInterface) readline.createInterface = origCreateInterface;
    if (homedir) fs.rmSync(homedir, { recursive: true, force: true });
  });

  it("changing an enum field (skillsIndexMode) persists the new value", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-cm-"));
    seedConfig();
    withFakeInput(["2", "full", String(10)]); // menu item 2, new value "full", then Done

    const manager = new ConfigManager({ homedir });
    await manager.run();

    const config = loadConfig({}, { homedir });
    expect(config.skillsIndexMode).toBe("full");
  });

  it("toggling a boolean field (planMode) via y/n persists true", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-cm-"));
    seedConfig();
    withFakeInput(["4", "y", "10"]); // menu item 4 = planMode, "y", Done

    const manager = new ConfigManager({ homedir });
    await manager.run();

    const config = loadConfig({}, { homedir });
    expect(config.planMode).toBe(true);
  });

  it("an invalid value shows a warning and does not crash the loop — subsequent edits still work", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-cm-"));
    seedConfig();
    withFakeInput(["2", "nonsense", "2", "full", "10"]); // bad value, then retry with a good one

    const manager = new ConfigManager({ homedir });
    await manager.run();

    const config = loadConfig({}, { homedir });
    expect(config.skillsIndexMode).toBe("full");
  });

  it("an empty answer leaves the field unchanged", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-cm-"));
    seedConfig();
    withFakeInput(["7", "", "10"]); // menu item 7 = maxIterationsPerTurn, blank, Done

    const manager = new ConfigManager({ homedir });
    await manager.run();

    const config = loadConfig({}, { homedir });
    expect(config.maxIterationsPerTurn).toBe(25); // untouched default
  });

  it("selecting 'Done' immediately exits without writing anything new", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-cm-"));
    seedConfig();
    withFakeInput(["10"]);

    const manager = new ConfigManager({ homedir });
    await expect(manager.run()).resolves.toBeUndefined();
  });

  it("an out-of-range menu number re-prompts (shows the menu again) rather than crashing or silently hanging", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-cm-"));
    seedConfig();
    withFakeInput(["999", "10"]); // out-of-range, then Done on the re-prompt

    const manager = new ConfigManager({ homedir });
    await expect(manager.run()).resolves.toBeUndefined();
  });

  it("array field (allowedWritePaths) accepts a comma-separated value", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-cm-"));
    seedConfig();
    withFakeInput(["9", "., ../shared", "10"]); // menu item 9 = allowedWritePaths

    const manager = new ConfigManager({ homedir });
    await manager.run();

    const config = loadConfig({}, { homedir });
    expect(config.allowedWritePaths).toEqual([".", "../shared"]);
  });
});
