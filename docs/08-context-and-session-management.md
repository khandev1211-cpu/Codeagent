# 08 — Context & Session Management

This doc covers two related but distinct concerns: **context window management** (what goes into each provider call) and **session persistence** (what survives across process restarts).

## Context window management (`src/agent/context.js`)

### Project context injection (at session start)

Rather than dumping the whole repository into the system prompt, the Context Manager builds a bounded summary once per session:
- A directory tree (respecting `.gitignore`, capped in depth/breadth) via the same logic `list_dir` uses.
- `package.json` (or equivalent manifest for other ecosystems) contents, since this tells the model the stack, dependencies, and scripts without it needing to ask.
- A README summary if present, truncated to a reasonable length.

This is injected once into the system prompt (doc 04) and is not re-sent in full on every turn — it's part of the fixed system prompt, not the growing conversation history.

### Conversation history growth

As a session progresses, the message list grows with every user turn and every tool call/result. Before each provider call, the Context Manager checks estimated token count (via the Provider Layer's `countTokens`, doc 06) against a configured threshold. When approaching the limit:

1. **Pin recent turns verbatim** — the last N turns are never summarized, since recent context is most likely to matter for the immediate next action.
2. **Summarize older turns** — a batch of older messages is condensed into a compact summary (itself generated via a provider call, kept short) that preserves what was done and why, without keeping full tool outputs (like entire file contents that were read earlier and are no longer needed verbatim).
3. **Keep "open" files pinned** — if a file was recently read or edited and is likely still relevant, its content is kept out of the summarization pass even if it falls outside the "recent N turns" window, since re-reading it later would just cost another tool call anyway.

This truncation strategy is deliberately conservative — it triggers on an approaching-limit threshold, not only once the limit is actually hit, so there's no scenario where a call fails outright due to context overflow.

## Session persistence (`src/session/store.js`)

### What's stored

- Full message history for the session (post any summarization already applied).
- Session metadata: id, project root path, created/updated timestamps, provider/model used.
- Stored as JSON under `~/.codeagent/sessions/<id>.json` by default (SQLite is a reasonable future upgrade if querying across sessions becomes a real need, but JSON is sufficient and simpler for v1).

### When it's written

After **every turn**, not just on clean exit — this is what makes a killed process (Ctrl+C, crash, terminal closed) lose at most the single in-flight turn rather than the whole session.

### Resuming

`codeagent --resume <id>` or `codeagent --resume last` loads the stored message history back into the Agent Core and continues the REPL from there, with the same project-context injection re-verified (if the project has changed significantly since the session was created, the Context Manager can flag that rather than silently working from stale project context).

## Diff Tracker (`src/session/diffTracker.js`)

Every destructive tool execution (doc 07) that actually runs (confirmed or `--yolo`-bypassed) is recorded here:
- File path, previous content (or "did not exist"), new content, timestamp, which turn triggered it.

This powers an `codeagent undo` command that can revert the most recent destructive change, or a specific one by reference. This is explicitly *not* a replacement for git — it's a fast, local safety net for "the agent just did something I want to immediately reverse," and users are still expected to use real version control for their actual project history (doc 01's non-goals).

## Interaction between the two systems

Context summarization (above) operates on the *conversation* the model sees. The Diff Tracker operates on *actual file state* and is never summarized or pruned for space — every destructive change stays fully recorded for the life of the session (and prunable only via explicit user action, e.g. clearing session history), since undo capability is a safety guarantee, not something that should degrade as a session gets long.
