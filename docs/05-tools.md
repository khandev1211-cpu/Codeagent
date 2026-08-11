# 05 — Tools

This document is the contract for every tool the agent can call. Each tool is a self-contained module in `src/tools/` exporting the same shape, so the Registry can auto-collect them and the orchestrator never needs tool-specific logic.

> **Naming history:** this doc used to be titled "Tools & Skills," using "skills" loosely to mean these same 6 tools. That collided with the real, separate Skills system (`docs/16`, `docs/18`, PLAN.md Phase 4) — discoverable `SKILL.md` folders with progressive disclosure, a genuinely different mechanism. Resolved 2026-07-14 by dropping "skills" from this doc's vocabulary entirely; there is now exactly one thing called "Skills" in this project.

## Tool module shape

```js
{
  name: "write_file",
  description: "Write content to a file, creating it if it doesn't exist or overwriting if it does.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path, relative to project root" },
      content: { type: "string", description: "Full file content to write" }
    },
    required: ["path", "content"]
  },
  destructive: true,
  execute: async (input, ctx) => { /* ... */ }
}
```

- `name` / `description` / `input_schema` are exactly what gets sent to the LLM provider as the tool's callable signature — this is the model-facing contract.
- `destructive` is read by the Safety Layer (doc 07) to decide whether confirmation is required.
- `execute(input, ctx)` is the actual implementation. `ctx` carries session/project context (working directory, config, logger) so tools don't need to import global state directly.

## The six core tools (v1)

### `read_file`
- **Purpose:** Read a file's contents so the model can reason about existing code.
- **Destructive:** No.
- **Input:** `{ path: string }`
- **Behavior:** Returns file content as text. For binary files, returns a clear "binary file, not readable as text" result rather than garbage bytes. Enforces a size cap (configurable, default reasonable for source files) and truncates with a clear marker if exceeded, rather than blowing the context window.

### `write_file`
- **Purpose:** Create a new file or fully overwrite an existing one.
- **Destructive:** Yes.
- **Input:** `{ path: string, content: string }`
- **Behavior:** Before writing, the Diff Tracker (doc 08) records the previous state (or "did not exist") so the action is undoable. Creates parent directories as needed. Refuses to write outside the project root unless explicitly configured otherwise (path traversal protection).

### `edit_file`
- **Purpose:** Make a targeted change to part of an existing file, rather than replacing the whole thing — this is what the model uses for surgical edits instead of rewriting entire files for small changes.
- **Destructive:** Yes.
- **Input:** `{ path: string, old_content: string, new_content: string }` (find-and-replace style; `old_content` must match uniquely).
- **Behavior:** Fails clearly (not silently) if `old_content` isn't found or isn't unique in the file, so the model can retry with more context rather than the tool guessing which occurrence was meant. Diff Tracker records the change.

### `list_dir`
- **Purpose:** Explore project structure.
- **Destructive:** No.
- **Input:** `{ path: string, recursive?: boolean }`
- **Behavior:** Respects `.gitignore` by default (don't show `node_modules`, build artifacts, etc., unless explicitly asked). Returns a clean tree structure, not raw `ls` output.

### `search_code`
- **Purpose:** Find where something is defined/used across the project without reading every file individually.
- **Destructive:** No.
- **Input:** `{ query: string, path?: string, file_pattern?: string }`
- **Behavior:** Backed by `ripgrep` where available (fast, respects `.gitignore` natively) with a plain-JS fallback if `rg` isn't installed on the system, so the tool doesn't hard-fail on a missing external binary.

### `run_bash`
- **Purpose:** Execute shell commands — running tests, installing dependencies, git operations, build scripts.
- **Destructive:** Yes (always — shell execution is treated as destructive by default regardless of the specific command, since the agent can't reliably pre-classify arbitrary commands as safe).
- **Input:** `{ command: string, cwd?: string }`
- **Behavior:** Executed via the cross-platform shell abstraction (picks `bash`/`sh` on POSIX, `cmd.exe` or PowerShell on Windows — this is the one tool most exposed to OS differences, see doc 02's cross-platform note). Captures stdout/stderr and exit code, returns all three to the model. Has a timeout (configurable) so a hanging command doesn't stall the whole session indefinitely. When `config.sandboxMode` is `"auto"` and a sandbox is available, writes are confined to the project root and `allowedWritePaths` (see `docs/15` for the full mechanism and limits).

## The expanded tool set (current)

Beyond the original six, codeagent now ships these additional tools. New tools are added to `BUILTIN_TOOLS` in `src/tools/index.js` — no other file needs to change:

### `skill_info`
- **Purpose:** Tier-2 lookup for the compact skills index (docs/19). When `config.skillsIndexMode: "compact"` (default), the system prompt carries only skill *names* — this tool returns the description + file path for specific names the model suspects are relevant.
- **Destructive:** No.
- **Input:** `{ names: string[] }`
- **Behavior:** Returns `{ ok: true, skills: [...] }` with `{ name, description, path }` per skill, or `{ ok: false, error }` if no skills are configured / input is malformed. Unknown names return `found: false` rather than erroring. **Deliberately not registered** when `skillsIndexMode: "full"` (that mode already carries descriptions inline, so the tool would be redundant surface area).

### `run_subagent`
- **Purpose:** Delegate a well-scoped sub-task to an isolated child agent (docs/11's Subagents plan, now shipped) — e.g. `general-researcher`, or custom agents defined in `.codeagent/agents/<name>.md`.
- **Destructive:** No.
- **Input:** `{ agent: string, task: string }`
- **Behavior:** Constructs a fresh `Orchestrator` with an isolated history, a restricted tool registry (defaults to the read-only set `read_file`/`search_code`/`list_dir`, or the `allowed-tools` list from the agent's frontmatter), and a subagent-specific system prompt. Returns the subagent's final text summary plus usage. Requires a configured provider instance to execute.

### `web_search`
- **Purpose:** Perform a web search for technical documentation, libraries, or error solutions.
- **Destructive:** No.
- **Input:** `{ query: string }`
- **Behavior:** Queries DuckDuckGo's HTML endpoint (no API key required), extracts up to 5 result snippets, and returns them as plain text. 10-second timeout; on failure returns a clear error rather than crashing the session.

### `web_fetch`
- **Purpose:** Fetch a URL and convert HTML to readable plain text.
- **Destructive:** No.
- **Input:** `{ url: string }`
- **Behavior:** Fetches the URL with a 10-second timeout, strips `<script>`/`<style>`/HTML tags, collapses whitespace, and truncates to 5,000 characters with a clear "...[truncated]" marker. Non-HTML responses (JSON, text) are returned as-is (also truncated to 5,000 chars).

## Adding a new tool

Covered in full in doc 11, but the short version: create one new file in `src/tools/` matching the shape above, register it in `src/tools/index.js`. No other file needs to change. This is deliberate — it's the primary mechanism by which this project is meant to grow (e.g. a future `run_tests` tool that wraps `run_bash` with test-framework-aware output parsing, or a `git_diff` tool for cleaner version-control-aware context).

## What's explicitly out of scope for tools (v1)

- **Direct database tools** — same reasoning as below; out of v1 scope, would need explicit design if added.
- Note: **network access tools** (`web_fetch`, `web_search`) are now shipped, with a deliberate design decision: they are marked `destructive: false` because they only perform read-only operations (fetching/searching public content, no local state mutation). They were previously listed as "out of scope without a dedicated safety classification" — that classification is now resolved: read-only network fetches carry the same non-destructive flag as `read_file`, while anything that writes or interacts with local state still routes through the normal Safety Layer.