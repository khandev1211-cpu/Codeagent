import { describe, it, expect } from "vitest";
import { runHook } from "../../src/hooks/runHook.js";

describe("runHook", () => {
  it("resolves decision 'allow' on exit code 0", async () => {
    const result = await runHook({ command: "exit 0" }, { event: "PreToolUse", tool: "run_bash" });
    expect(result.decision).toBe("allow");
  });

  it("resolves decision 'block' with stderr as reason on exit code 2", async () => {
    const result = await runHook(
      { command: "echo 'nope' 1>&2; exit 2" },
      { event: "PreToolUse", tool: "run_bash" }
    );
    expect(result.decision).toBe("block");
    expect(result.reason).toBe("nope");
  });

  it("resolves decision 'error' (fail-open) on other non-zero exit codes", async () => {
    const result = await runHook({ command: "exit 7" }, { event: "PreToolUse" }, { logger: { warn: () => {} } });
    expect(result.decision).toBe("error");
  });

  it("resolves decision 'error' when the hook exceeds its timeout", async () => {
    const result = await runHook(
      { command: "sleep 5" },
      { event: "PreToolUse" },
      { timeoutMs: 100, logger: { warn: () => {} } }
    );
    expect(result.decision).toBe("error");
    expect(result.reason).toMatch(/timed out/);
  }, 10_000);

  it("extracts a string `context` field from JSON stdout", async () => {
    const result = await runHook(
      { command: "echo '{\"context\":\"hello from hook\"}'" },
      { event: "PostToolUse" }
    );
    expect(result.context).toBe("hello from hook");
  });

  it("ignores non-JSON stdout gracefully (context stays null)", async () => {
    const result = await runHook({ command: "echo 'just some text'" }, { event: "PostToolUse" });
    expect(result.decision).toBe("allow");
    expect(result.context).toBeNull();
  });

  it("writes the event payload to the hook's stdin as JSON", async () => {
    const result = await runHook(
      { command: "cat | grep -q '\"tool\":\"run_bash\"' && exit 0 || exit 2" },
      { event: "PreToolUse", tool: "run_bash", input: { command: "ls" } }
    );
    expect(result.decision).toBe("allow");
  });
});
