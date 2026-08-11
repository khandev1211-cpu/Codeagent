import { describe, it, expect } from "vitest";
import { buildRestrictedToolRegistry, buildSubagentSystemPrompt } from "../../src/agent/subagent.js";
import { ToolRegistry } from "../../src/tools/registry.js";

function makeTool(name) {
  return { name, description: name, destructive: false, input_schema: { type: "object", properties: {} }, async execute() {} };
}

describe("buildRestrictedToolRegistry", () => {
  const parent = new ToolRegistry([makeTool("read_file"), makeTool("write_file"), makeTool("run_subagent")]);

  it("always excludes run_subagent, even when allowedToolNames is null (inherit everything)", () => {
    const scoped = buildRestrictedToolRegistry(parent, null);
    expect(scoped.has("run_subagent")).toBe(false);
    expect(scoped.has("read_file")).toBe(true);
    expect(scoped.has("write_file")).toBe(true);
  });

  it("narrows to the given tool names when allowedToolNames is provided", () => {
    const scoped = buildRestrictedToolRegistry(parent, ["read_file"]);
    expect(scoped.has("read_file")).toBe(true);
    expect(scoped.has("write_file")).toBe(false);
  });

  it("never grants a tool the parent doesn't have, even if named in allowedToolNames", () => {
    const scoped = buildRestrictedToolRegistry(parent, ["read_file", "run_bash"]);
    expect(scoped.has("read_file")).toBe(true);
    expect(scoped.has("run_bash")).toBe(false);
  });

  it("excludes run_subagent even when explicitly named in allowedToolNames", () => {
    const scoped = buildRestrictedToolRegistry(parent, ["read_file", "run_subagent"]);
    expect(scoped.has("run_subagent")).toBe(false);
  });
});

describe("buildSubagentSystemPrompt", () => {
  it("returns exactly the definition's instructions, with no composition with a parent prompt", () => {
    const definition = { name: "x", description: "d", instructions: "Only these instructions." };
    expect(buildSubagentSystemPrompt(definition)).toBe("Only these instructions.");
  });
});
