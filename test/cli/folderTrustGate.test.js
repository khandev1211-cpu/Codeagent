import { describe, it, expect } from "vitest";
import { shouldRequireFolderTrust } from "../../src/cli/index.js";

function argv(...args) {
  return ["node", "codeagent", ...args];
}

describe("shouldRequireFolderTrust", () => {
  it("requires trust for a plain one-shot request string", () => {
    expect(shouldRequireFolderTrust(argv("fix the bug in app.js"))).toBe(true);
  });

  it("requires trust for no arguments at all (interactive mode)", () => {
    expect(shouldRequireFolderTrust(argv())).toBe(true);
  });

  it("requires trust for a one-shot request even with --yolo/--plan/--autonomous flags present", () => {
    expect(shouldRequireFolderTrust(argv("--yolo", "fix it"))).toBe(true);
    expect(shouldRequireFolderTrust(argv("--autonomous", "build the feature"))).toBe(true);
  });

  it("does not require trust for --help or --version, regardless of other args", () => {
    expect(shouldRequireFolderTrust(argv("--help"))).toBe(false);
    expect(shouldRequireFolderTrust(argv("-h"))).toBe(false);
    expect(shouldRequireFolderTrust(argv("--version"))).toBe(false);
    expect(shouldRequireFolderTrust(argv("-V"))).toBe(false);
  });

  it("does not require trust for every exempt command", () => {
    for (const cmd of ["setup", "config", "providers", "use", "models", "skills", "subagents", "memory", "commands", "mcp", "hooks", "permissions", "sessions", "usage", "quota", "trust", "system-prompt"]) {
      expect(shouldRequireFolderTrust(argv(cmd))).toBe(false);
    }
  });

  it("does not require trust for an exempt command with additional arguments", () => {
    expect(shouldRequireFolderTrust(argv("config", "set", "sandboxMode", "off"))).toBe(false);
    expect(shouldRequireFolderTrust(argv("quota", "set", "anthropic", "10"))).toBe(false);
  });

  it("DOES require trust for 'undo' — it reverts real project files", () => {
    expect(shouldRequireFolderTrust(argv("undo"))).toBe(true);
  });

  it("requires trust for an unrecognized token (commander will treat it as the [request] positional anyway)", () => {
    expect(shouldRequireFolderTrust(argv("totallyNotACommand"))).toBe(true);
  });

  it("skips leading flags to find the first real (non-flag) token", () => {
    expect(shouldRequireFolderTrust(argv("--model", "gpt-5", "config"))).toBe(false);
  });
});
