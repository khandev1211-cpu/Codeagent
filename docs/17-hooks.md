# 17 — Hooks

## Principle

Hooks let a project react to what the agent is doing — without forking codeagent's core loop to do it. They're the foundation Phase 4 (Skills), Phase 6 (Subagents), and Phase 8 (Plugins) build on top of (doc 16), but they're independently useful the moment they exist: auto-format a file after it's edited, block edits to a protected path, log every command the agent runs.

Hooks are a **veto and observation layer in front of the existing Safety Layer (doc 07), not a replacement for it.** A hook can say no to a tool call before it happens; nothing about the hooks system lets a hook silently say yes on the user's behalf. `--yolo` still comes from the user, explicitly, the same way it always has.

## Events (`src/hooks/events.js`)

v1 ships four events — the ones with a natural seam in the existing code, not a front-loaded copy of every event type a larger product might have:

| Event | Fires | Can it block? |
|---|---|---|
| `PreToolUse` | Before a tool call reaches the Safety Layer's `confirm()` | Yes — exit code `2` stops the call before confirmation or execution |
| `PostToolUse` | After a tool call executes successfully | No — the action already happened; a hook can only report, via `context` |
| `SessionStart` | Once, when a session begins (new or resumed) | No |
| `SessionEnd` | Once, when a session ends | No |

## Configuration (`.codeagent/hooks.json`)

Project-scoped only for v1, mirroring the existing `.codeagent/config.json` convention (doc 09). Personal (`~/.codeagent`) and plugin-bundled hooks are deferred to the Plugins phase (doc 16) — that's where a real multi-scope loading story belongs.

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "run_bash", "command": "./scripts/check-command.sh" }
    ],
    "PostToolUse": [
      { "matcher": "write_file|edit_file", "command": "npx prettier --write \"$CODEAGENT_TOOL_PATH\"" }
    ]
  }
}
```

- `matcher` — pipe-separated tool names, e.g. `"write_file|edit_file"`. Omit it (or use `"*"`) to match every tool.
- `command` — a shell command. v1 supports shell hooks only; HTTP/prompt/agent-based hook types are a later iteration (PLAN.md Phase 3), not because they're hard, but because shell hooks already match the pattern `run_bash` (doc 05) already established, and nothing yet needs more than that.
- `timeout` — optional, milliseconds, defaults to 30s. A hook that hangs past this is killed and treated as a non-blocking failure (see below), not a stuck agent.

Run `codeagent hooks` to see what's currently configured for a project.

## The hook contract (`src/hooks/runHook.js`)

A hook process receives the event payload as JSON on stdin (also exposed as `CODEAGENT_EVENT`/`CODEAGENT_TOOL` env vars for convenience), and communicates back via exit code:

- **Exit `0`** — allow, no objection.
- **Exit `2`** — block. Only enforced for `PreToolUse`; for the other three events there's nothing left to block, so it's logged as a warning instead of acted on. Whatever the hook wrote to stderr becomes the reason shown to the model in the tool_result.
- **Any other non-zero exit, a timeout, or a spawn failure** — treated as the hook itself being broken: logged, but **never blocks the call**. This is deliberate — a typo in a hook script must not be able to silently freeze every tool call in the project. Fail open, not closed.
- **stdout**, if it parses as JSON with a string `context` field, is surfaced back — for `PostToolUse` this gets appended to the tool_result the model sees (e.g. "formatted with prettier"); for the other events it's captured but not yet surfaced anywhere, since there's no obvious place to put it yet.

## Where this plugs into the loop (`src/agent/orchestrator.js`)

`Orchestrator` takes an optional `hookRegistry` (defaults to a no-op `NULL_HOOK_REGISTRY`, so every existing call site and test that doesn't pass one behaves exactly as before). Two invocation points were added to the existing per-tool loop — no restructuring of the loop's control flow:

1. Right after `tool_call` is emitted, **before** `this.confirm(...)` — a `PreToolUse` block skips confirmation and execution entirely and synthesizes an error `tool_result`.
2. Right after a successful `tool.execute(...)` — a `PostToolUse` hook's `context`, if any, is appended to the `tool_result` content; a `blocked: true` here is logged, not enforced.

`SessionStart`/`SessionEnd` don't live inside `runTurn` at all, since a turn isn't a session — they fire once each from the CLI layer (`src/cli/index.js`'s `oneShot`/`interactive`), around the whole session lifecycle rather than per-turn.

## What Hooks does *not* do

- It does not let a `PreToolUse` hook auto-approve or otherwise skip the existing confirm/`--yolo` flow — hooks only add a way to say no, never a way to bypass the existing way to say yes.
- It does not retry a blocked call automatically or rewrite the tool's input — a block is terminal for that call; the model sees why and can adjust its next request.
- It does not (yet) support personal- or plugin-scoped hooks, HTTP/prompt/agent hook types, or an `Stop`/`SubagentStop`-style event set — all explicitly deferred, not overlooked (doc 16).

## Testing this layer

- `test/hooks/runHook.test.js` — the exit-code/timeout/context contract in isolation, against real spawned shells (not mocked, since the contract *is* the shell interaction).
- `test/hooks/loadHooksConfig.test.js` — config loading/validation against real temp-directory files.
- `test/hooks/registry.test.js` — matcher filtering, aggregate block/context behavior, fail-open on a broken hook.
- `test/agent/orchestrator.test.js` — integration-level: a blocking `PreToolUse` hook actually skips `confirm()`/`execute()`; a `PostToolUse` hook's context lands in the right place; the no-hook-registry default behaves identically to before Phase 3 landed.
