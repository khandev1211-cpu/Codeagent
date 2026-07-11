# 07 — Safety & Permissions

## Principle

Destructive action requires human consent by default. This is not a feature that can be quietly disabled per-tool — it's enforced structurally: every tool execution passes through the Safety Layer before running, and the Safety Layer is the only thing that can grant the bypass, and only when the user has explicitly requested it.

## Classification (`src/safety/policy.js`)

Every tool declares `destructive: true | false` in its own definition (doc 05). The policy module reads this flag — it does not re-derive destructiveness from the command text itself (e.g. it does not try to parse `run_bash`'s command string to guess if it's "safe"). Guessing at safety from command content is a common source of both false confidence (a "safe-looking" command that isn't) and false friction (over-flagging harmless commands); a flat, explicit per-tool flag is more predictable and easier to audit than a heuristic classifier.

Given that, `run_bash` is always `destructive: true` regardless of the specific command (see doc 05's reasoning), while `read_file`, `list_dir`, and `search_code` are always `destructive: false`.

## Confirmation flow (`src/safety/confirm.js`)

When a destructive tool call reaches the Safety Layer:

1. Render a clear, specific summary of what's about to happen — for `write_file`/`edit_file`, this means showing the actual diff, not just "write_file was called."
2. Prompt the user: allow / decline / allow-and-remember-for-this-session (for repeated similar actions, e.g. multiple edits to the same file in one task).
3. On decline, synthesize a `tool_result` telling the model the user declined, so the model can adjust its plan rather than the session just erroring out.
4. On allow, proceed to actual execution and let the Diff Tracker (doc 08) record the before-state.

## `--yolo` bypass (`src/safety/yolo.js`)

- Explicit, opt-in, per-invocation flag (`codeagent --yolo`) or an explicit config setting (never a default).
- When active, all destructive calls skip the interactive prompt and execute directly.
- Every bypassed confirmation is still logged (what tool, what input, timestamp) so there's an audit trail even when no human was asked in the moment — this matters for debugging "what did the agent actually do" after an unattended `--yolo` run, e.g. in CI.
- `--yolo` does not disable the Diff Tracker or undo capability — bypassing confirmation doesn't mean bypassing recoverability.

## What Safety does *not* do

- It does not attempt content-level judgment about whether a requested code change is "a good idea" — that's out of scope; this layer gates *destructive I/O operations*, not code quality or correctness.
- It does not silently downgrade a destructive call to non-destructive to reduce friction. If a tool is marked destructive, it's gated, full stop — no exceptions carved out for "this one's probably fine."
- It does not persist a blanket "always allow everything" setting from a prior session into a new one silently — "allow-and-remember" (step 2 above) is scoped to the current session only, so a new session starts with confirmations active again unless `--yolo` is explicitly passed again.

## Path and command boundaries

Beyond the confirm/decline flow, two structural guards apply regardless of confirmation outcome:

- **Path traversal protection:** `write_file`/`edit_file` refuse to write outside the resolved project root unless the user has explicitly configured a broader scope (doc 09). This applies even under `--yolo` — `--yolo` bypasses the confirmation prompt, not the boundary itself.
- **Command execution scope:** `run_bash`'s working directory defaults to the project root and is never silently escalated to a broader filesystem scope by the tool itself; if the model requests a `cwd` outside the project, that's still just a parameter passed through the normal destructive-call confirmation, not a separate privileged path.

## Testing this layer

Safety Layer tests specifically assert: (a) every tool with `destructive: true` cannot execute without either explicit confirmation or explicit `--yolo`, (b) decline paths produce a `tool_result` the model can act on rather than crashing the session, and (c) path/command boundary checks hold under both confirmed and `--yolo` execution (doc 12).

## Relationship to Hooks (doc 17)

As of Phase 3, a `PreToolUse` hook runs *before* this layer's `confirm()` and can block a call outright. This is a veto layer stacked in front of Safety, not a change to Safety itself — a hook can only add a way to say no; nothing about it lets a hook satisfy or skip the confirm/`--yolo` decision described above. See doc 17 for the full contract.
