# 31 — Autonomous Mode

Not from `docs/16`'s Tier 1/2/3 audit — a direction chosen after comparing codeagent's interaction model against Manus AI's: mandatory upfront planning, continuous "recitation" of the plan back into context on long tasks, self-verification before declaring done, and a single final summary instead of a back-and-forth. The explicit design constraint for this feature: adopt Manus's *workflow discipline*, not its *safety posture*. Confirmation prompts are what this mode skips — the sandbox (`config.sandboxMode`, docs/15) and `allowedWritePaths` (docs/07/09) are not touched by this feature at all and stay exactly as strict as they already are.

## What Autonomous Mode actually changes

| Mechanism | Normal mode | Autonomous Mode |
|---|---|---|
| Destructive-call confirmation | Prompts per action (or `--yolo` bypasses, same as always) | Auto-approved — same underlying `createConfirmer` yolo path, not a new bypass mechanism |
| Sandbox (`run_bash` write confinement) | Active | **Unchanged, always active** |
| `allowedWritePaths` | Enforced | **Unchanged, always enforced** |
| Hooks / permission rules | Apply | **Unchanged, apply identically** |
| Planning before execution | Optional (`config.planningEnabled`, or the phrase "make a plan") | **Mandatory** — every turn starts with a decomposed task list |
| Mid-task goal tracking | None | The task list is **recited** back into context periodically (see below) |
| Self-verification before finishing | Whatever the model does on its own | **Explicitly instructed** in the system prompt: run tests/lint/the code itself before declaring the task done |
| Turn output | Same running commentary as any turn | Same live tool-call visibility, but the system prompt asks for one clear final summary (what was built, how it was verified) rather than assuming the user is available to adjudicate every step |

The row that matters most: **confirmation is what's skipped, not the safety mechanisms underneath it.** A destructive `run_bash` call in Autonomous Mode still can't write outside the sandboxed allowlist, still goes through hooks and permission rules — it just doesn't stop to ask "is this okay?" first, the same way `--yolo` already doesn't. Autonomous Mode is best understood as `--yolo` plus a different *workflow*, not a different *safety* posture.

## Enabling it

`--autonomous` (a CLI flag, session-only — does not persist to `~/.codeagentrc` the way `codeagent config set` would) or `config.autonomousMode: boolean` for a standing per-project/global default. Setting `autonomousMode: true` implies the same auto-approve behavior `yolo: true` already provides (reuses `createConfirmer`'s existing yolo branch — no second bypass mechanism written) and additionally changes planning/system-prompt behavior as described below. `--autonomous` on the CLI sets both `config.autonomousMode` and `config.yolo` for that invocation.

## Mandatory planning

`shouldPlan()` (`src/agent/planner.js`) already exists — Autonomous Mode simply makes it unconditionally true, no phrase-matching needed. The plan itself is unchanged in *how* it's produced (`planTurn()`, a lightweight side-call to the same provider), but its role changes: in normal mode a plan is shown once and the turn proceeds; in Autonomous Mode the plan is retained as **state** for the rest of the turn, not just displayed and discarded.

## Recitation: keeping a long turn on-track

Manus's own published reasoning for this technique (verified via their engineering writeup): continuously rewriting the todo list into the end of context counters "lost-in-the-middle" drift on long tool-use loops, without needing any architectural change — it's a context-engineering technique, not a new capability.

Implementation: `Orchestrator.runTurn()`'s existing iteration loop (`src/agent/orchestrator.js`) already tracks `iterations`. In Autonomous Mode, every `RECITATION_INTERVAL` iterations (default 5 — frequent enough to matter on a genuinely long task, infrequent enough not to waste tokens restating an already-short plan on a quick one), a synthetic user-role message is appended to history before the next provider call: the original task list, plus which items look done based on tool calls so far. This is deliberately a *plain conversation message*, not a system-prompt rewrite — the system prompt is set once per turn and rewriting it mid-loop would need provider-specific cache-invalidation handling; a periodic message costs a little more per-recitation but works identically across every provider adapter without special-casing any of them.

## Self-verification before finishing

The system prompt gains an Autonomous-Mode-only section instructing the model to verify its own work before producing a final answer — run the test suite if one exists, run linting if configured, actually execute what it built rather than assuming it works. This is instruction-only (no new tool, no enforcement mechanism) — the same category of thing the admin prompt and memory sections already are: guidance the model is told to take seriously, not a code-level gate. A coding agent that writes a function and immediately declares victory without running it is exactly the failure mode this section exists to reduce.

## What "just tell me it's done" looks like

No new mechanism needed for this part — it falls out of the two changes above. A model that planned up front, worked through the plan with periodic recitation keeping it on-track, and was explicitly told to verify before finishing, naturally produces a single coherent final message describing what got built and how it was checked — rather than the more conversational, checking-in tone a turn produces by default. This doc doesn't prescribe an exact format for that final message; shaping it further based on real usage is a reasonable follow-up, not something to over-specify before it's been tried.

## What this doesn't do (v1)

- **No background/async execution.** Manus's cloud-VM-per-task model runs independently of the user's device; Autonomous Mode is still a normal, synchronous `codeagent` invocation — the terminal is occupied for the duration, same as any other turn. True background execution (start a task, do something else, get notified) is a materially bigger feature (needs a persistent daemon or job queue, a notification mechanism, and answers to what happens if the terminal closes) — worth a separate design pass if genuinely needed, not folded into this one.
- **No multi-agent Planner/Executor/Verifier split.** Autonomous Mode still runs through the single `Orchestrator` loop — planning is a lightweight side-call (`planTurn()`), not a separate agent role with its own state. Subagents (docs/22) already provide scoped delegation for genuinely separable subtasks; a rigid three-role pipeline for every turn would be more architecture than this feature needs.
- **No hosted cloud sandbox.** Execution stays exactly where it already runs — the user's own machine, through the existing `bubblewrap`/`sandbox-exec` sandbox (docs/15). codeagent's identity is local-first and BYO-key; adopting Manus's cloud-VM-per-task model would change what the product fundamentally is, not just how it behaves.
- **No removal of the sandbox or `allowedWritePaths` in this mode, ever.** Explicitly restated because it's the one thing this feature must never quietly regress: Autonomous Mode changes the *conversation*, not the *machine-level blast radius* of what a destructive call can reach.
