# 32 — Structured Output (`--output-format`) and Git Tools

Two small, independent additions aimed at scripting/CI use and cleaner version-control context.

## `--output-format <text|json|stream-json>` (one-shot only)

| Format | stdout |
|---|---|
| `text` (default) | Unchanged human-readable output. |
| `json` | Nothing until the run ends, then **one** JSON object. |
| `stream-json` | NDJSON: one JSON object per line as events happen, then the same final result line. |

In both JSON modes stdout carries only JSON; logs/warnings go to **stderr**, so `khanagent --output-format json "..." | jq` always works.

Final result line (always emitted exactly once, on success *and* failure, including config/API-key errors that happen before the agent starts):

```json
{"type":"result","ok":true,"exit_code":0,"result":"<final assistant text>","session_id":"...","usage":{"input_tokens":10,"output_tokens":5}}
```

On failure: `"ok": false`, `"error": "<message>"`, and a non-zero `exit_code` (2 = a configured limit was exceeded, 1 = anything else — same codes as text mode).

`stream-json` event types: `tool_call`, `tool_result`, `tool_declined`, `tool_blocked`, `tool_denied`, `tool_planned`, `tool_error`, `provider_error`, `assistant`, `result`.

Design notes:
- `tool_result` events carry only `ok`/`error`, **never the tool's output** — it can be very large and may contain file contents the caller didn't ask to see.
- `--output-format json|stream-json` without a request is an error: it only applies to one-shot runs.
- Confirmation prompts: in JSON modes, run non-interactively (`--yolo`, `--plan`, permission rules, or a non-TTY stdin, where destructive calls are declined with exit code 1). An interactive prompt would write to the terminal.

## `git_status` and `git_diff` tools

Read-only (`destructive: false`, so no confirmation prompt), replacing the model's habit of calling `run_bash "git diff"` — which is always treated as destructive and needs approval.

- `git_status` → `{ ok, branch, clean, files }` (`files` is porcelain v1: `XY <path>`).
- `git_diff` → `{ ok, diff }`; inputs `staged` (bool), `ref` (e.g. `HEAD~1`, `main...HEAD`), `path` (relative to the project).

Safety properties (all covered by `test/tools/git.test.js`):
- Run via `execFile`, never through a shell.
- `ref` must match a strict allow-list pattern and may not start with `-` — otherwise `--output=<file>` would make `git diff` write a file, defeating the "read-only" claim.
- `path` is passed after `--` and must stay inside the project.
- `--no-ext-diff --no-textconv` and `core.fsmonitor=false`: a hostile repository's config can't run programs through these tools. `--no-optional-locks` keeps `git_status` from writing to the index.
- Output capped at 100 KB (`truncated: true` when cut); 30 s timeout.
