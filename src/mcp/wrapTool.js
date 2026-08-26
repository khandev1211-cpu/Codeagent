/**
 * Converts one MCP server's tool descriptor (from client.listTools()) into
 * exactly the same Tool shape every built-in tool uses (`name`,
 * `description`, `input_schema`, `destructive`, `execute`) — PLAN.md's
 * stated goal: "the orchestrator and Safety Layer treat them identically
 * to built-in tools, no separate code path." Once wrapped, an MCP tool
 * goes through ToolRegistry.register() exactly like `read_file` does —
 * every safety mechanism (confirm, hooks, permission rules, Plan Mode)
 * applies with zero MCP-specific branching anywhere in orchestrator.js.
 */

/**
 * Namespacing every MCP tool as `mcp__<server>__<toolName>` serves two
 * purposes at once: it can never collide with a built-in tool name (or
 * another server's tool of the same name), and the name itself signals
 * to both the model and anyone reading a confirmation prompt or audit
 * log that this call is going out to third-party code, not codeagent's
 * own — transparency as a side effect of the collision-avoidance
 * mechanism, not a separate feature.
 */
export function mcpToolName(serverName, toolName) {
  return `mcp__${serverName}__${toolName}`;
}

/**
 * "MCP tools default to destructive: true unless a server explicitly
 * marks otherwise" (PLAN.md) — and even then, only one specific,
 * positive signal is trusted: `annotations.readOnlyHint === true`.
 * `destructiveHint: false` is deliberately NOT treated as sufficient on
 * its own — per the MCP spec, annotations are hints a server volunteers
 * about itself, unverified by the protocol, and "explicitly claims to be
 * non-destructive" is a weaker signal than "explicitly claims to be
 * read-only." This is the "no safety opt-out" principle docs/11 already
 * states for plugin tools, applied here: the safe default wins unless a
 * server clears the higher bar, not the lower one.
 */
export function isMcpToolDestructive(annotations) {
  return annotations?.readOnlyHint !== true;
}

/**
 * MCP tool results are a `content` array of typed blocks (text, image,
 * resource, ...) rather than a plain string — normalized here into a
 * single string the model can read, since every built-in tool already
 * returns a flat result shape. Non-text blocks are summarized by type
 * rather than dropped silently, so the model at least knows something
 * was returned that isn't representable inline.
 */
export function formatMcpToolResult(result) {
  const parts = (result.content || []).map((block) => {
    if (block.type === "text") return block.text;
    return `[${block.type} content, not shown inline]`;
  });
  return parts.join("\n");
}

/**
 * `callFn` is injected (rather than this module importing client.js
 * directly) so wrapping logic is testable with a fake call function —
 * no real subprocess, no SDK, no network. The wrapped tool's `execute`
 * takes the exact (input, ctx) shape every other tool does, but ignores
 * ctx entirely — an MCP tool has no use for cwd/config/diffTracker/etc.,
 * it only ever needs the input the model provided.
 */
export function wrapMcpTool({ serverName, mcpTool, callFn }) {
  return {
    name: mcpToolName(serverName, mcpTool.name),
    description: `[MCP: ${serverName}] ${mcpTool.description || mcpTool.name}`,
    input_schema: mcpTool.inputSchema,
    destructive: isMcpToolDestructive(mcpTool.annotations),
    async execute(input) {
      const result = await callFn(mcpTool.name, input);
      const text = formatMcpToolResult(result);
      // isError is the MCP protocol's own way of saying "this tool call
      // failed" (distinct from a transport-level error, which throws) —
      // surfaced as ok: false, same as every built-in tool's failure
      // shape, so the orchestrator's tool_error handling doesn't need an
      // MCP-specific branch either.
      if (result.isError) return { ok: false, error: text };
      return { ok: true, content: text };
    },
  };
}
