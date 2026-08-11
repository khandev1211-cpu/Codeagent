import { describe, it, expect } from "vitest";
import { logHookBlock } from "../../src/hooks/audit.js";

function makeLogger() {
  const info = [];
  const warn = [];
  return { logger: { info: (...a) => info.push(a), warn: (...a) => warn.push(a) }, info, warn };
}

describe("logHookBlock", () => {
  it("logs at info level by default, with tool, input, reason, and a timestamp", () => {
    const { logger, info } = makeLogger();
    logHookBlock(logger, { event: "PreToolUse", toolName: "run_bash", input: { command: "rm -rf /" }, reason: "policy says no" });
    expect(info).toHaveLength(1);
    const [message, details] = info[0];
    expect(message).toMatch(/PreToolUse/);
    expect(message).toMatch(/run_bash/);
    expect(details.toolName).toBe("run_bash");
    expect(details.input).toEqual({ command: "rm -rf /" });
    expect(details.reason).toBe("policy says no");
    expect(details.event).toBe("PreToolUse");
    expect(typeof details.timestamp).toBe("string");
    expect(() => new Date(details.timestamp).toISOString()).not.toThrow();
  });

  it("logs at warn level when explicitly requested (PostToolUse, after-the-fact case)", () => {
    const { logger, info, warn } = makeLogger();
    logHookBlock(logger, { event: "PostToolUse", toolName: "write_file", input: {}, reason: "too late", level: "warn" });
    expect(warn).toHaveLength(1);
    expect(info).toHaveLength(0);
  });

  it("never throws when no logger is provided", () => {
    expect(() => logHookBlock(undefined, { event: "PreToolUse", toolName: "x", input: {}, reason: "r" })).not.toThrow();
  });
});
