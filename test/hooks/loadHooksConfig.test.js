import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadHooksConfig } from "../../src/hooks/loadHooksConfig.js";
import { ConfigError } from "../../src/utils/errors.js";

describe("loadHooksConfig", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-hooks-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty hooks object when .codeagent/hooks.json doesn't exist", () => {
    expect(loadHooksConfig({ cwd: tmpDir })).toEqual({ hooks: {} });
  });

  it("loads and validates a well-formed hooks.json", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "hooks.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: "run_bash", command: "echo checking" }],
        },
      })
    );
    const result = loadHooksConfig({ cwd: tmpDir });
    expect(result.hooks.PreToolUse).toHaveLength(1);
    expect(result.hooks.PreToolUse[0].command).toBe("echo checking");
  });

  it("throws ConfigError on malformed JSON", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(path.join(tmpDir, ".codeagent", "hooks.json"), "{ not valid json");
    expect(() => loadHooksConfig({ cwd: tmpDir })).toThrow(ConfigError);
  });

  it("throws ConfigError on an unknown event name", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "hooks.json"),
      JSON.stringify({ hooks: { NotARealEvent: [{ command: "echo hi" }] } })
    );
    expect(() => loadHooksConfig({ cwd: tmpDir })).toThrow(ConfigError);
  });

  it("throws ConfigError when a hook definition is missing a command", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "hooks.json"),
      JSON.stringify({ hooks: { PreToolUse: [{ matcher: "run_bash" }] } })
    );
    expect(() => loadHooksConfig({ cwd: tmpDir })).toThrow(ConfigError);
  });
});
