# 20 — Permission Rules & Plan Mode

## Principle

This evolves the existing Safety Layer (doc 07) rather than replacing it. `isDestructive()` and `createConfirmer()` are unchanged — `confirm.js`'s only modification was extracting and exporting `summarizeCall()` so Plan Mode could reuse it instead of duplicating per-tool description logic. Everything new here sits in front of that existing gate, in the orchestrator's loop, in a fixed precedence order.

## Naming note: this is not the same "plan" as `planningEnabled`

The codebase already had an unrelated feature using the word "plan": `agent/planner.js`'s `shouldPlan`/`planTurn`, gated by `config.planningEnabled`, which generates a task checklist shown to the user *before* execution — a planning aid; execution still happens normally afterward.

**Plan Mode** (`config.planMode`, this doc) is a different, unrelated thing: a read-only execution mode where destructive tools describe what they would do *instead of* running at all, for the whole session. The name matches Claude Code's own actual "Plan Mode" feature — kept deliberately rather than renamed to avoid the collision, since diverging from that naming would undercut the whole point of aiming at Claude Code parity. The two features are independent and can be used together (get a task checklist, then watch it describe each step instead of performing it) or separately.

## Permission rules (`.codeagent/permissions.json`)

Project-scoped only for v1, same convention as `hooks.json` (doc 17) and `skills/` (doc 19) — personal/plugin-scoped rules are a Plugins-phase concern.

```json
{
  "rules": [
    { "tool": "run_bash", "pattern": "npm test*", "behavior": "allow" },
    { "tool": "write_file", "pattern": "*.env", "behavior": "deny" }
  ]
}
```

- `tool` — an exact tool name. Unlike Hooks' matcher, there's no pipe-separated multi-tool list or `"*"` wildcard here — one rule targets one tool. Simpler, deliberately; broaden later only if a real need shows up.
- `pattern` — matched against one specific field of the tool's input, per tool (`run_bash` → `command`, `write_file`/`edit_file`/`read_file`/`list_dir` → `path`, `search_code` → `query`). A tool with no entry in that mapping can never match any rule — always falls through to the normal confirm/`--yolo` flow, never a silent gap.
- Glob support is intentionally minimal (`src/safety/glob.js`): just `*` and `?`, no dependency added, enough for command/path patterns like `"npm test*"` or `"*.env"`.

**Deny always wins.** If both an allow and a deny rule match the same call, the result is deny — regardless of which was listed first in the file. This is a deliberate security choice: a silently-shadowed deny rule (a broad allow placed after a narrow deny) would be a far worse failure mode than an occasionally-too-cautious prompt. Confirmed with a real end-to-end run: a deny rule blocks a real `rm` command via the real `run_bash` tool even with `--yolo` active — `--yolo` bypasses the *interactive confirmation*, not an explicit deny rule; those are different gates.

`codeagent permissions` lists configured rules — read-only, matching the `codeagent hooks`/`codeagent skills` pattern.

## Plan Mode (`--plan`, `config.planMode`)

A structural guarantee, not a confirmation the model can talk past: while active, `tool.execute()` is never called for any destructive tool, regardless of what permission rules or `confirm()` would otherwise decide. Non-destructive tools (`read_file`, `list_dir`, `search_code`) are unaffected — the model still needs to explore the project while planning; only actions that would change something get intercepted.

```bash
codeagent --plan "refactor the auth module"
```

Confirmed with a real end-to-end run: the real `write_file` tool, real filesystem, a file that genuinely was not modified — only a `[plan mode — not executed] write_file -> ...` description came back.

**v1 scope: session-long only, no in-REPL toggle yet.** `--plan` sets the mode for the whole invocation. An in-REPL `/plan` toggle (matching PLAN.md's original "in-REPL toggle" idea) is deferred — the REPL has no slash-command recognition mechanism at all yet, and that's explicitly its own, separate Tier-1 gap in doc 16's audit. Building a one-off `/plan`-only recognizer now would mean redoing it once real slash commands land; better to wait and get it once, correctly.

## Precedence, in order (`agent/orchestrator.js`)

For each tool call, in this exact order — the first one that applies decides the outcome:

1. **`PreToolUse` hook** (doc 17) — can block outright.
2. **Permission rule: deny** — hard stop, reached before `confirm()`, so there's never an interactive prompt for something explicit policy already forbade. Takes precedence over Plan Mode too — a denied call never even reaches the "would this run" description.
3. **Plan Mode** (if active and the tool is destructive) — synthesizes a description via `describePlannedAction()` (which reuses `summarizeCall()`) instead of executing.
4. **Permission rule: allow** — pre-authorizes the call, skipping `confirm()` entirely (the action still genuinely happens — this only skips the interactive question, not the execution).
5. **`confirm()`** (doc 07, unchanged) — the existing interactive/`--yolo`/remembered-this-session gate, only reached if nothing above already decided the outcome.
6. **`tool.execute()`** — only reached if every gate above allowed it.

## What this doesn't do

- No rule broadening beyond one-tool-per-rule / `*`+`?` globs — no regex, no multi-tool matchers. Additive later if a real need appears.
- No personal- or plugin-scoped permission rules yet — same reasoning as Hooks and Skills.
- No in-REPL Plan Mode toggle yet — waiting on real slash commands (doc 16).
- Permission rules don't apply retroactively or audit past calls — this is a forward-looking gate, not a logging/audit system (a "permission-rule audit logging" idea was floated early on but isn't built; would be additive, not a redesign, if it's ever needed).

## Testing this layer

- `test/safety/glob.test.js` — the minimal glob matcher's contract, including that it never throws on a non-string subject.
- `test/safety/permissionRules.test.js` — config loading/validation, and `evaluatePermissionRules`'s decision logic, with explicit tests for deny-wins-over-allow in both file orders, and that a tool with no configured subject field can never accidentally resolve to allow.
- `test/safety/planMode.test.js` — `describePlannedAction`'s output format, confirming it reuses `summarizeCall` rather than a parallel implementation.
- `test/agent/orchestrator.test.js` — the full precedence chain as it actually runs: a deny rule stops execution before `confirm()`; an allow rule skips `confirm()` but the action still happens; Plan Mode intercepts a destructive tool with zero calls to `execute()`; Plan Mode leaves non-destructive tools untouched; a deny rule still wins even with Plan Mode active; and the no-rules/no-plan-mode default behaves identically to before this phase existed.
- Two real end-to-end smoke runs (not part of the automated suite, run manually during development): Plan Mode against the real `write_file` tool and a real file on disk (confirmed untouched), and a deny rule against the real `run_bash` tool with `--yolo` active (confirmed the command never ran).
