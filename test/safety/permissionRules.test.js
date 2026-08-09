import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPermissionRules, evaluatePermissionRules } from "../../src/safety/permissionRules.js";
import { ConfigError } from "../../src/utils/errors.js";

describe("loadPermissionRules", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-permrules-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty rules array when .codeagent/permissions.json doesn't exist", () => {
    expect(loadPermissionRules({ cwd: tmpDir })).toEqual({ rules: [] });
  });

  it("loads and validates a well-formed rules file", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "permissions.json"),
      JSON.stringify({ rules: [{ tool: "run_bash", pattern: "npm test*", behavior: "allow" }] })
    );
    const result = loadPermissionRules({ cwd: tmpDir });
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toEqual({ tool: "run_bash", pattern: "npm test*", behavior: "allow" });
  });

  it("throws ConfigError on malformed JSON", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(path.join(tmpDir, ".codeagent", "permissions.json"), "{ not valid");
    expect(() => loadPermissionRules({ cwd: tmpDir })).toThrow(ConfigError);
  });

  it("throws ConfigError on an invalid behavior value", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "permissions.json"),
      JSON.stringify({ rules: [{ tool: "run_bash", pattern: "x", behavior: "maybe" }] })
    );
    expect(() => loadPermissionRules({ cwd: tmpDir })).toThrow(ConfigError);
  });

  it("throws ConfigError when a rule is missing a required field", () => {
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "permissions.json"),
      JSON.stringify({ rules: [{ tool: "run_bash", behavior: "deny" }] })
    );
    expect(() => loadPermissionRules({ cwd: tmpDir })).toThrow(ConfigError);
  });
});

describe("evaluatePermissionRules", () => {
  it("resolves to no-match when no rules are configured", () => {
    expect(evaluatePermissionRules([], "run_bash", { command: "ls" })).toEqual({
      decision: "no-match",
      rule: null,
    });
  });

  it("resolves to allow when only an allow rule matches", () => {
    const rules = [{ tool: "run_bash", pattern: "npm test*", behavior: "allow" }];
    const result = evaluatePermissionRules(rules, "run_bash", { command: "npm test -- --watch" });
    expect(result.decision).toBe("allow");
    expect(result.rule).toEqual(rules[0]);
  });

  it("resolves to deny when only a deny rule matches", () => {
    const rules = [{ tool: "write_file", pattern: "*.env", behavior: "deny" }];
    const result = evaluatePermissionRules(rules, "write_file", { path: "packages/api/.env" });
    expect(result.decision).toBe("deny");
  });

  it("resolves to no-match when the pattern doesn't match the actual input", () => {
    const rules = [{ tool: "run_bash", pattern: "npm test*", behavior: "allow" }];
    const result = evaluatePermissionRules(rules, "run_bash", { command: "rm -rf /" });
    expect(result.decision).toBe("no-match");
  });

  it("resolves to no-match when the rule targets a different tool", () => {
    const rules = [{ tool: "write_file", pattern: "*", behavior: "deny" }];
    const result = evaluatePermissionRules(rules, "run_bash", { command: "ls" });
    expect(result.decision).toBe("no-match");
  });

  // The security-critical guarantee: deny always wins, regardless of file
  // order, when both an allow and a deny rule match the same call.
  it("deny wins over allow when both match, deny listed first", () => {
    const rules = [
      { tool: "run_bash", pattern: "npm *", behavior: "deny" },
      { tool: "run_bash", pattern: "npm test*", behavior: "allow" },
    ];
    const result = evaluatePermissionRules(rules, "run_bash", { command: "npm test" });
    expect(result.decision).toBe("deny");
  });

  it("deny wins over allow when both match, allow listed first", () => {
    const rules = [
      { tool: "run_bash", pattern: "npm test*", behavior: "allow" },
      { tool: "run_bash", pattern: "npm *", behavior: "deny" },
    ];
    const result = evaluatePermissionRules(rules, "run_bash", { command: "npm test" });
    expect(result.decision).toBe("deny");
  });

  it("a tool with no configured subject field always resolves to no-match, never a false allow", () => {
    // list_dir's subject field is "path" per SUBJECT_FIELD_BY_TOOL; a tool
    // this module has never heard of must not accidentally match "*".
    const rules = [{ tool: "some_future_tool", pattern: "*", behavior: "allow" }];
    const result = evaluatePermissionRules(rules, "some_future_tool", { anything: "x" });
    expect(result.decision).toBe("no-match");
  });
});
