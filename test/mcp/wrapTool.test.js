import { describe, it, expect } from "vitest";
import { wrapMcpTool, mcpToolName, isMcpToolDestructive, formatMcpToolResult } from "../../src/mcp/wrapTool.js";

describe("mcpToolName", () => {
  it("namespaces as mcp__<server>__<tool>", () => {
    expect(mcpToolName("github", "create_issue")).toBe("mcp__github__create_issue");
  });
});

describe("isMcpToolDestructive", () => {
  it("defaults to destructive when annotations are absent entirely", () => {
    expect(isMcpToolDestructive(undefined)).toBe(true);
  });

  it("defaults to destructive when annotations exist but say nothing about read-only", () => {
    expect(isMcpToolDestructive({ title: "Some tool" })).toBe(true);
  });

  it("is non-destructive only when readOnlyHint is explicitly true", () => {
    expect(isMcpToolDestructive({ readOnlyHint: true })).toBe(false);
  });

  it("does NOT trust destructiveHint: false on its own — readOnlyHint is the only signal honored", () => {
    expect(isMcpToolDestructive({ destructiveHint: false })).toBe(true);
  });

  it("readOnlyHint: false is still destructive (redundant but explicit)", () => {
    expect(isMcpToolDestructive({ readOnlyHint: false })).toBe(true);
  });
});

describe("formatMcpToolResult", () => {
  it("joins multiple text blocks with newlines", () => {
    const result = { content: [{ type: "text", text: "line one" }, { type: "text", text: "line two" }] };
    expect(formatMcpToolResult(result)).toBe("line one\nline two");
  });

  it("summarizes non-text blocks by type rather than dropping them", () => {
    const result = { content: [{ type: "image", data: "base64...", mimeType: "image/png" }] };
    expect(formatMcpToolResult(result)).toBe("[image content, not shown inline]");
  });

  it("returns an empty string when content is missing or empty", () => {
    expect(formatMcpToolResult({})).toBe("");
    expect(formatMcpToolResult({ content: [] })).toBe("");
  });
});

describe("wrapMcpTool", () => {
  const mcpTool = {
    name: "create_issue",
    description: "Creates a GitHub issue.",
    inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
  };

  it("produces exactly the Tool shape every built-in tool uses", () => {
    const tool = wrapMcpTool({ serverName: "github", mcpTool, callFn: async () => ({ content: [] }) });
    expect(tool).toMatchObject({
      name: "mcp__github__create_issue",
      input_schema: mcpTool.inputSchema,
      destructive: true,
    });
    expect(typeof tool.execute).toBe("function");
    expect(tool.description).toContain("github");
    expect(tool.description).toContain("Creates a GitHub issue.");
  });

  it("is non-destructive when the server marks the tool readOnlyHint: true", () => {
    const readOnlyTool = { ...mcpTool, annotations: { readOnlyHint: true } };
    const tool = wrapMcpTool({ serverName: "github", mcpTool: readOnlyTool, callFn: async () => ({ content: [] }) });
    expect(tool.destructive).toBe(false);
  });

  it("execute() calls callFn with the MCP tool's own name (not the namespaced one) and the given input", async () => {
    let captured;
    const callFn = async (name, input) => {
      captured = { name, input };
      return { content: [{ type: "text", text: "done" }] };
    };
    const tool = wrapMcpTool({ serverName: "github", mcpTool, callFn });
    await tool.execute({ title: "Bug report" });
    expect(captured).toEqual({ name: "create_issue", input: { title: "Bug report" } });
  });

  it("execute() returns ok: true with formatted content on success", async () => {
    const callFn = async () => ({ content: [{ type: "text", text: "Issue #42 created." }] });
    const tool = wrapMcpTool({ serverName: "github", mcpTool, callFn });
    const result = await tool.execute({ title: "x" });
    expect(result).toEqual({ ok: true, content: "Issue #42 created." });
  });

  it("execute() returns ok: false when the MCP result has isError: true", async () => {
    const callFn = async () => ({ isError: true, content: [{ type: "text", text: "Permission denied." }] });
    const tool = wrapMcpTool({ serverName: "github", mcpTool, callFn });
    const result = await tool.execute({ title: "x" });
    expect(result).toEqual({ ok: false, error: "Permission denied." });
  });
});
