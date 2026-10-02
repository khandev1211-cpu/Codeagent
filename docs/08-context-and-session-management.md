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
- Stored as JSON under `~/.khanagent/sessions/<id>.json` by default (SQLite is a reasonable future upgrade if querying across sessions becomes a real need, but JSON is sufficient and simpler for v1).

### When it's written

After **every turn**, not just on clean exit — this is what makes a killed process (Ctrl+C, crash, terminal closed) lose at most the single in-flight turn rather than the whole session.

### Resuming

`khanagent --resume <id>` or `khanagent --resume last` loads the stored message history back into the Agent Core and continues the REPL from there, with the same project-context injection re-verified (if the project has changed significantly since the session was created, the Context Manager can flag that rather than silently working from stale project context).

## Diff Tracker (`src/session/diffTracker.js`)

Every destructive tool execution (doc 07) that actually runs (confirmed or `--yolo`-bypassed) is recorded here:
- File path, previous content (or "did not exist"), new content, timestamp, which turn triggered it.

This powers an `khanagent undo` command that can revert the most recent destructive change, or a specific one by reference. This is explicitly *not* a replacement for git — it's a fast, local safety net for "the agent just did something I want to immediately reverse," and users are still expected to use real version control for their actual project history (doc 01's non-goals).

## Interaction between the two systems

Context summarization (above) operates on the *conversation* the model sees. The Diff Tracker operates on *actual file state* and is never summarized or pruned for space — every destructive change stays fully recorded for the life of the session (and prunable only via explicit user action, e.g. clearing session history), since undo capability is a safety guarantee, not something that should degrade as a session gets long.

## Naming, resuming by name, and forking sessions

```bash
khanagent sessions                          # id, name, provider/model, message count, fork parent
khanagent rename-session last "auth work"   # ref = id, name, or "last"
khanagent --resume "auth work"              # resume by id OR name (case-insensitive)
khanagent fork "auth work" --name try-redis # branch the conversation; ref defaults to "last"
```

- **Names** are 1-60 characters, no control characters, unique per project (case-insensitive). A name that looks like a session id (12 hex characters) or is the word `last` is rejected, because ids and `last` are resolved first and such a name could never be reached.
- **Resolution** accepts an id only in its real 12-hex shape, so a reference such as `../../x` can never be turned into a file path.
- **Fork** copies the message history into a brand-new session (`forkedFrom` records the parent) that then diverges independently; the original is not modified. The **undo history is deliberately not copied**: it points at file changes the original session made, and two sessions both able to revert the same change would be a trap. Run `khanagent undo` in the session that made the change.
- `rename-session` and `fork` only touch `~/.khanagent/sessions/`, never the project, so like `sessions` they are exempt from the folder-trust gate.

## Rewinding a conversation (`khanagent rewind`)

```bash
khanagent rewind --list                        # numbered turns of the latest session
khanagent rewind                               # drop the last turn
khanagent rewind "auth work" --turns 2         # drop the last 2 turns
khanagent rewind last --to 3 --name before-redis   # keep only turns 1-2
```

Rewind is **non-destructive**: it creates a NEW session (a fork, see above) containing the conversation up to the chosen point, and leaves the original exactly as it was. There is deliberately no in-place mode; if you want the old state back, it is still there.

- A *turn* starts at a real user message. Tool results are also stored as `role: "user"` messages, so they are not counted as turns, and a cut never lands between an assistant `tool_use` and its `tool_result` (the provider would reject that conversation).
- Rewinding to before turn 1, or dropping every turn, is refused: that is a new session, not a rewind.
- **Files are not reverted.** Rewind only changes the conversation. Edits the dropped turns made to your files stay on disk; revert them with `khanagent undo` in the session that made them. The new session starts with an empty undo history, same as `fork`.
- Like `sessions`/`fork`/`rename-session`, it only touches `~/.khanagent/sessions/` and is exempt from the folder-trust gate.
