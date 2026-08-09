import { describe, it, expect } from "vitest";
import { HookRegistry, NULL_HOOK_REGISTRY } from "../../src/hooks/registry.js";
import { HOOK_EVENTS } from "../../src/hooks/events.js";

describe("HookRegistry.run", () => {
  it("returns not-blocked with no context when no hooks are configured for the event", async () => {
    const registry = new HookRegistry({ hooksConfig: { hooks: {} } });
    const result = await registry.run(HOOK_EVENTS.PRE_TOOL_USE, { tool: "run_bash" });
    expect(result).toEqual({ blocked: false, reason: null, context: null });
  });

  it("blocks when a matching PreToolUse hook exits 2, and surfaces stderr as the reason", async () => {
    const registry = new HookRegistry({
      hooksConfig: {
        hooks: {
          [HOOK_EVENTS.PRE_TOOL_USE]: [
            { matcher: "run_bash", command: "echo 'no rm -rf allowed' 1>&2; exit 2" },
          ],
        },
      },
    });
    const result = await registry.run(HOOK_EVENTS.PRE_TOOL_USE, { tool: "run_bash", cwd: "/tmp" });
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/no rm -rf allowed/);
  });

  it("does not run a hook whose matcher excludes the current tool", async () => {
    const registry = new HookRegistry({
      hooksConfig: {
        hooks: {
          [HOOK_EVENTS.PRE_TOOL_USE]: [{ matcher: "write_file", command: "exit 2" }],
        },
      },
    });
    const result = await registry.run(HOOK_EVENTS.PRE_TOOL_USE, { tool: "run_bash", cwd: "/tmp" });
    expect(result.blocked).toBe(false);
  });

  it("runs a matcher-less hook for every tool", async () => {
    const registry = new HookRegistry({
      hooksConfig: {
        hooks: {
          [HOOK_EVENTS.PRE_TOOL_USE]: [{ command: "exit 2" }],
        },
      },
    });
    const result = await registry.run(HOOK_EVENTS.PRE_TOOL_USE, { tool: "anything", cwd: "/tmp" });
    expect(result.blocked).toBe(true);
  });

  it("surfaces JSON stdout `context` from an allowing hook without blocking", async () => {
    const registry = new HookRegistry({
      hooksConfig: {
        hooks: {
          [HOOK_EVENTS.POST_TOOL_USE]: [
            { matcher: "write_file", command: "echo '{\"context\":\"formatted with prettier\"}'" },
          ],
        },
      },
    });
    const result = await registry.run(HOOK_EVENTS.POST_TOOL_USE, { tool: "write_file", cwd: "/tmp" });
    expect(result.blocked).toBe(false);
    expect(result.context).toBe("formatted with prettier");
  });

  it("fails open (does not block) when a hook exits non-zero for a reason other than 2", async () => {
    const registry = new HookRegistry({
      hooksConfig: {
        hooks: {
          [HOOK_EVENTS.PRE_TOOL_USE]: [{ command: "exit 1" }],
        },
      },
      logger: { warn: () => {} },
    });
    const result = await registry.run(HOOK_EVENTS.PRE_TOOL_USE, { tool: "run_bash", cwd: "/tmp" });
    expect(result.blocked).toBe(false);
  });

  it("fails open when the hook command itself is broken", async () => {
    const registry = new HookRegistry({
      hooksConfig: {
        hooks: {
          [HOOK_EVENTS.PRE_TOOL_USE]: [{ command: "this_command_does_not_exist_anywhere" }],
        },
      },
      logger: { warn: () => {} },
    });
    const result = await registry.run(HOOK_EVENTS.PRE_TOOL_USE, { tool: "run_bash", cwd: "/tmp" });
    expect(result.blocked).toBe(false);
  });

  it("has() reflects whether an event has any configured hooks", () => {
    const registry = new HookRegistry({
      hooksConfig: { hooks: { [HOOK_EVENTS.PRE_TOOL_USE]: [{ command: "exit 0" }] } },
    });
    expect(registry.has(HOOK_EVENTS.PRE_TOOL_USE)).toBe(true);
    expect(registry.has(HOOK_EVENTS.POST_TOOL_USE)).toBe(false);
  });
});

describe("NULL_HOOK_REGISTRY", () => {
  it("never blocks and never configures anything", async () => {
    expect(NULL_HOOK_REGISTRY.has(HOOK_EVENTS.PRE_TOOL_USE)).toBe(false);
    const result = await NULL_HOOK_REGISTRY.run(HOOK_EVENTS.PRE_TOOL_USE, { tool: "run_bash" });
    expect(result).toEqual({ blocked: false, reason: null, context: null });
  });
});
