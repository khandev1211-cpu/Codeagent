# 22 — Subagents (design writeup, Phase 6)

`docs/11`'s own review bar: a change that touches `orchestrator.js` directly needs a short design writeup before code, not just a PR. This is that writeup for PLAN.md's Phase 6 item.

## What a subagent is

A scoped, single-turn `Orchestrator.runTurn()` call: its own message history (empty at start — no visibility into the parent conversation beyond the task string explicitly handed to it), its own system prompt (the subagent definition's instructions), and optionally a restricted subset of tools. It runs to completion synchronously and returns its final answer as a tool result to the parent turn, exactly like any other tool call.

## The core design decision: reuse `Orchestrator`, don't build a second one

A subagent is not a different execution engine — it is *another instance of the same one*, constructed with a narrower tool registry and a fresh, empty history. Concretely: `Orchestrator._runSubagentTurn()` builds a new `Orchestrator` reusing the parent's `provider`, `confirm`, `hookRegistry`, `permissionRules`, `contextManager`, `config`, `logger`, and `skillRegistry` — only `toolRegistry` and the message history differ.

This one decision resolves most of the hard safety questions for free:

- **Destructive-call confirmation still applies inside a subagent.** Because the child `Orchestrator` is handed the exact same `confirm` function as the parent, every destructive tool call a subagent makes goes through the identical confirmation prompt (or the identical `--yolo` bypass, identically logged) as if the parent had called it directly. There is no separate, weaker safety path for subagent-originated actions.
- **Hooks and permission rules still apply.** Same reasoning — same `hookRegistry`, same `permissionRules` instances, not copies. A `PreToolUse` deny rule that blocks `run_bash` for the parent blocks it identically inside a subagent.
- **Plan Mode still applies.** `config.planMode` is part of the shared `config` object, so a subagent spawned while Plan Mode is active is just as read-only as the parent.

Because of this, `run_subagent` itself is `destructive: false` — invoking a subagent isn't the destructive act; whatever destructive tool calls it makes *inside* its own run are independently gated exactly as they would be at the top level. Marking the outer call destructive too would just be a redundant confirmation prompt for something that carries no risk on its own.

## Tool-subset restriction

Default: the subagent gets every tool the parent has, **except `run_subagent` itself** — this is the v1 recursion boundary. A subagent cannot spawn a subagent. Explicit invocation only (PLAN.md's own scoping decision), one level deep, is the smallest version of this feature that's actually useful and provable; unbounded recursive delegation is a v2 question, not a v1 requirement, and removing `run_subagent` from the child's registry is a two-line guarantee that no accidental infinite-recursion bug can happen while that question is unanswered.

A subagent definition's frontmatter can narrow this further with a `tools:` field (comma-separated), reusing the exact same field name and parsing Skills already established for `allowed-tools`. Narrowing is always an intersection with what the parent already had — a subagent definition can restrict a coding-review subagent to `read_file, search_code, list_dir` (no writes at all), but it can never *grant* a tool the parent doesn't have. Same "no privilege escalation" principle `pathGuard.js`'s `allowedWritePaths` already applies to write scope, extended to tool scope.

## Filesystem-based definitions

`.codeagent/agents/<name>.md`, same frontmatter+body shape as Skills (`name`, `description`, optional `tools`, then free-form body as the subagent's system prompt) — for the same consistency-with-Phase-4 reason PLAN.md names, and because it reuses `parseFrontmatter` (`src/skills/frontmatter.js`) as-is rather than writing a second parser for an identical format.

Discovery mirrors `discoverSkills`: project-scoped only for v1 (`.codeagent/agents/`, not `~/.codeagent/agents/`), a malformed or incomplete definition is skipped with a warning rather than crashing startup, same reasoning as Skills — one broken subagent definition must not take down the whole session.

## Synchronous, not background

The main loop blocks on `runSubagentTurn()` until it resolves. PLAN.md already named this as the right v1 choice, and the reasoning holds: background execution is a real concurrency-model decision (what does the parent loop show while waiting? can the user issue new commands? does a background subagent's own confirmation prompts collide with the parent's?) that deserves its own design pass if it's ever needed, not a default assumed here as a side effect of building the rest of this feature.

## Explicit invocation only (v1)

The model calls `run_subagent` with `{ name, task }` — it does not automatically decide to delegate to a subagent on its own. Same reasoning as Skills' progressive disclosure: prove the mechanism works and is genuinely useful with an explicit, visible invocation point before making the decision-to-delegate an implicit, harder-to-audit thing the model does silently mid-turn.

## System prompt footprint

Subagent definitions get a full inline index (name + description) in the system prompt, not the two-tier compact treatment Skills needed — deliberately not applying `docs/19`'s fix here preemptively. Skills needed it because 102 skills is a real, measured cost (~6,500 tokens/turn). A project's subagent count is expected to be small (a handful of specialized roles, not a library of a hundred skills) — the same two-tier pattern is available (`wireSkillsIndex` is the template) if subagent counts ever grow enough to justify it, but building it now for a problem that doesn't exist yet would be speculative, the same mistake Skills' original "known but deferred" flag was written specifically to avoid repeating.

## What this doesn't do (v1)

- No recursive subagents (a subagent's tool registry never includes `run_subagent`) — see "tool-subset restriction" above.
- No background/async execution — synchronous only.
- No personal (`~/.codeagent/agents`) or plugin-bundled subagent definitions — deferred to the Plugins phase, same as Skills.
- No automatic delegation — the model must explicitly call `run_subagent`.
- `docs/01`'s "not a multi-agent framework" non-goal needs a follow-up pass once this ships, so it stops contradicting a shipped feature — tracked in PLAN.md, not done silently as part of this doc.
