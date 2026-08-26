# 25 — MCP Client

Phase 7 of PLAN.md, additive to the existing Tool Registry (`docs/11` already supports arbitrary tool registration) — this is a new *source* of tools, not a new registration mechanism.

## Use the official SDK, don't hand-roll the protocol

`@modelcontextprotocol/sdk` handles the actual JSON-RPC 2.0 framing, the MCP handshake (`initialize`, capability negotiation), and request/response correlation. Same reasoning `commander`, `ink`, and `zod` are already dependencies here: a real protocol with an official reference implementation is a "use the library" case — unlike, say, `src/safety/sandbox.js`'s `bubblewrap`/`sandbox-exec` wrapping, which is direct OS process control with no comparable standard library to defer to. `src/mcp/client.js` is a thin, three-function wrapper (`connectMcpServer`, `listMcpTools`, `callMcpTool`) so the rest of the MCP layer can be tested against a fake `client` object without a real subprocess or the SDK involved at all.

## The core decision: wrap, don't special-case

An MCP tool becomes exactly the same `{name, description, input_schema, destructive, execute}` shape every built-in tool already is (`src/mcp/wrapTool.js`'s `wrapMcpTool`). Once wrapped and `toolRegistry.register()`-ed, it is indistinguishable to the orchestrator from `read_file` — same confirmation flow, same hooks, same permission rules, same Plan Mode gating, zero MCP-specific branching anywhere in `orchestrator.js`. This is PLAN.md's stated goal verbatim ("no separate code path") and the same pattern Subagents (`docs/22`) used for safety composition: reuse the existing mechanism rather than parallel-implementing a second one.

## Naming: `mcp__<server>__<toolName>`

Every wrapped tool is namespaced this way for two reasons at once, not two separate features:

1. **Collision avoidance** — an MCP tool can never collide with a built-in tool name or another server's tool of the same name.
2. **Transparency** — the name itself signals to the model, and to anyone reading a confirmation prompt or audit log, that a given call is going out to third-party code, not codeagent's own. This matters specifically because MCP tool results are untrusted third-party output — same caution `run_bash`'s stdout already gets — and a name that makes the origin obvious is a small but real part of that.

## Destructive-by-default, and which annotation is trusted

MCP tools default to `destructive: true` unless a server explicitly marks otherwise (PLAN.md's stated principle) — and only one specific, positive signal is trusted: `annotations.readOnlyHint === true`. A server's `destructiveHint: false` is deliberately **not** sufficient on its own (`isMcpToolDestructive` in `wrapTool.js`). Per the MCP spec, annotations are hints a server volunteers about itself, unverified by the protocol — "I explicitly claim to be read-only" is a meaningfully stronger, more specific claim than "I explicitly claim not to be destructive." This is `docs/11`'s "no safety opt-out" principle for plugin tools, applied here: the safe default only yields to the higher bar, not the lower one.

## `.codeagent/mcp.json` and its trust boundary

Modeled loosely on Claude Code's `.mcp.json` — an `mcpServers` object keyed by server name, each with `command`/`args`/`env`. stdio transport only in v1 (PLAN.md: "simplest, matches how most local MCP servers run"); HTTP/SSE transports are a later addition, not a silently-dropped gap.

A project-committed `.codeagent/mcp.json` is trusted at exactly the same level `.codeagent/hooks.json` already is: both define commands that execute automatically at session start, and both are "the project's own committed config" — the same trust boundary as any other code checked into the repo. This isn't a new, weaker boundary invented for MCP; it's the existing one Hooks already established, applied consistently.

## Failure handling: one broken server doesn't take down the session

`connectAllMcpServers` (`src/mcp/index.js`) connects to every configured server in parallel; a single server failing to connect, or connecting but failing to list its tools, is caught, logged as a warning, and excluded — the session (and every other configured server) proceeds normally. Same "one broken X doesn't take down the agent" principle `discoverSkills`/`discoverSubagents`/`discoverSlashCommands` already use for malformed definition files, extended here to connection failures rather than parse failures.

## Lifecycle: connect once per session, close at the end

MCP servers are real subprocesses. `connectAllMcpServers` is called once per session (one-shot CLI invocation, REPL startup, or TUI startup) rather than per-turn, to avoid reconnect overhead on every message — and `closeAllMcpClients` runs in a `finally` block (one-shot) or at loop/app exit (REPL, TUI) specifically so a session ending doesn't leak server processes. `codeagent mcp` (the CLI visibility command, mirroring `codeagent skills`/`codeagent subagents`/`codeagent hooks`) connects, lists, and then also closes — it's a diagnostic snapshot, not a persistent connection.

## Tool result shape

MCP results are a `content` array of typed blocks (text, image, resource, ...), not a plain string — `formatMcpToolResult` flattens this into a single string, since every built-in tool already returns a flat shape the orchestrator expects. Non-text blocks are summarized by type (`[image content, not shown inline]`) rather than dropped silently, so the model at least knows something non-text came back. `isError: true` (MCP's own protocol-level way of signaling a failed tool call, distinct from a transport error, which throws) is surfaced as `{ok: false, error: text}` — the same failure shape every built-in tool already uses, so `orchestrator.js`'s `tool_error` handling needs no MCP-specific branch either.

## What this doesn't do (v1)

- **HTTP/SSE transports** — stdio only, per PLAN.md's stated v1 scope.
- **Personal (`~/.codeagent/mcp.json`) or plugin-bundled server configs** — deferred to the Plugins phase, same as Skills, Subagents, and Slash Commands.
- **Resources and Prompts** (two other first-class MCP primitives beyond Tools) — out of scope for this phase; only the Tools capability is wired up.
- **Mid-session reconnection or `listChanged` handling** — a server's tool list is captured once at connection time; a server that dynamically adds tools mid-session won't be picked up without restarting the session.
- **Any special trust elevation for a server's own claims about itself** beyond the one narrow `readOnlyHint` exception above — annotations are hints, not guarantees, and are treated that cautiously throughout.
