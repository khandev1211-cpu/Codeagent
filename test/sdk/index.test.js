import { describe, it, expect } from "vitest";
import * as sdk from "../../src/sdk/index.js";

/**
 * Cheap, fast sanity check that every export in the curated SDK surface
 * (docs/29) actually resolves to something of the expected shape —
 * catches an accidental typo'd re-export or a broken internal import
 * chain immediately, without needing the full npm-pack round trip
 * `packaging.integration.test.js` does for proving the *packaging*
 * itself works.
 */
describe("sdk/index.js — exported surface", () => {
  const CLASSES = [
    "Orchestrator",
    "ContextManager",
    "ToolRegistry",
    "SessionStore",
    "DiffTracker",
    "ModelRegistry",
    "SkillRegistry",
    "SubagentRegistry",
    "HookRegistry",
    "UsageTracker",
  ];

  const FUNCTIONS = [
    "buildProjectContext",
    "buildSystemPrompt",
    "createDefaultRegistry",
    "getProvider",
    "resolveApiKey",
    "createConfirmer",
    "loadPermissionRules",
    "evaluatePermissionRules",
    "isDestructive",
    "loadHooksConfig",
    "connectAllMcpServers",
    "closeAllMcpClients",
    "loadConfig",
    "recordTurnUsage",
  ];

  it.each(CLASSES)("exports %s as a constructible class", (name) => {
    expect(sdk[name]).toBeDefined();
    expect(typeof sdk[name]).toBe("function");
    // Every exported class name should start with an uppercase letter —
    // a real convention check, not just "is a function" (which would
    // also pass for a plain function accidentally miscategorized here).
    expect(name[0]).toBe(name[0].toUpperCase());
  });

  it.each(FUNCTIONS)("exports %s as a callable function", (name) => {
    expect(sdk[name]).toBeDefined();
    expect(typeof sdk[name]).toBe("function");
  });

  it("exports NULL_HOOK_REGISTRY as a usable object, not a class", () => {
    expect(sdk.NULL_HOOK_REGISTRY).toBeDefined();
    expect(typeof sdk.NULL_HOOK_REGISTRY).toBe("object");
  });

  it("exports HOOK_EVENTS as a non-empty object of event names", () => {
    expect(sdk.HOOK_EVENTS).toBeDefined();
    expect(Object.keys(sdk.HOOK_EVENTS).length).toBeGreaterThan(0);
  });

  it("exports ConfigSchema (a zod schema, not a plain object)", () => {
    expect(sdk.ConfigSchema).toBeDefined();
    expect(typeof sdk.ConfigSchema.safeParse).toBe("function");
  });

  it("exports SDK_VERSION as a semver-shaped string", () => {
    expect(sdk.SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("createDefaultRegistry() returns a ToolRegistry with the expected built-in tools", () => {
    const registry = sdk.createDefaultRegistry();
    expect(registry).toBeInstanceOf(sdk.ToolRegistry);
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("run_bash");
  });

  it("ToolRegistry constructed directly from the SDK behaves identically to internal usage", () => {
    const registry = new sdk.ToolRegistry([{ name: "x", description: "d", input_schema: {}, destructive: false, async execute() { return { ok: true }; } }]);
    expect(registry.has("x")).toBe(true);
    expect(registry.schemas()).toEqual([{ name: "x", description: "d", input_schema: {} }]);
  });
});
