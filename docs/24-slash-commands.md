# 24 — Slash Commands

The parity gap named in `docs/16`: reusable custom prompts as files, invoked in-REPL with argument substitution, plus (as a direct consequence of finally having slash-command recognition) the in-REPL `/plan` toggle `docs/20`/PLAN.md had explicitly deferred pending this.

## Two kinds of slash command

**Built-in** (`help`, `clear`, `plan`) — fixed, never shadowable by a project's own `.codeagent/commands/<name>.md` with the same name. Same reasoning tool names like `run_subagent`/`skill_info` aren't shadowable by a project's own tool definitions: a small, fixed vocabulary the user can rely on regardless of what a given project has configured.

**Custom** (`.codeagent/commands/<name>.md`) — same frontmatter+body shape as Skills and Subagents (`name`, `description`, then the body as a prompt template), for the same consistency reasoning those two features already used, and the same `parseFrontmatter` reuse. A custom command resolves to a *prompt string*, not a special execution path — once resolved, it's handed to the orchestrator exactly as if the user had typed it directly. This is deliberate: no new "command execution" concept needed in the orchestrator at all, no new safety surface, no new tool. It's string expansion, nothing more.

## Argument substitution

`$ARGUMENTS` in the template is replaced with whatever the user typed after the command name (`/review file.js` → `args = "file.js"`). If the template has no `$ARGUMENTS` placeholder but the user supplied arguments anyway, they're appended at the end rather than silently discarded — a command author who forgot the placeholder shouldn't have the user's input vanish.

## Where resolution happens vs. where execution happens

`resolveSlashCommand()` (`src/agent/slashCommands.js`) is pure and synchronous — parses input, looks up the registry, returns a descriptor (`{type: "help"}`, `{type: "clear"}`, `{type: "plan-toggle"}`, `{type: "prompt", text}`, `{type: "unknown", ...}`, or `{type: "none"}` for non-slash input). It does not clear a session, toggle config, or call the orchestrator itself.

Execution is the caller's job, and deliberately duplicated (not shared) between `repl.js` and `App.js` (TUI) — they hold different session/UI state (a readline loop vs React state + `appendEntry`), so a single shared "executor" would need its own indirection layer to abstract over two genuinely different environments. Given the small number of action types, duplicating the ~15-line dispatch is simpler than that abstraction would be.

## The `/plan` toggle, specifically

`config.planMode = !config.planMode` — mutates the same config object reference the `Orchestrator` instance already holds (`this.config = config`, not a copy), so no `Orchestrator.setConfig()` method was needed: `orchestrator.js`'s dispatch loop already reads `this.config?.planMode` fresh on every tool call, so the very next destructive-tool dispatch sees the toggle immediately. The TUI additionally calls `setPlanMode()` to keep the `StatusHeader`'s display in sync — that React state already existed (initialized from `config.planMode`) but had no toggle wired to it before this.

## What this doesn't do (v1)

- **No personal (`~/.codeagent/commands/`) or plugin-bundled commands** — deferred to the Plugins phase, same as Skills and Subagents.
- **No namespacing/subdirectories** (e.g. `/git:commit`) — a flat command namespace is the smallest version of this that's useful; nested namespacing is speculative complexity for a project size not yet demonstrated to need it.
- **No frontmatter-level tool restriction** for custom commands (unlike Subagents' `tools:` field) — a custom command expands to a plain prompt in the *current* conversation with the *current* tool set; it isn't a new scoped execution context the way a subagent is, so there's nothing analogous to restrict.
- **No command chaining/composition** (one slash command invoking another) — the expanded text is just what the user "said" for that turn; nothing prevents a template from mentioning another command's name in its body, but there's no special resolution of that.
