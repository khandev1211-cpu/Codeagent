# 19 — Skills

## Principle

A skill is optional, discoverable instructions for a specific kind of task — closer to Claude Code's actual `SKILL.md` model than the config-toggle-plus-prompt-addendum version PLAN.md originally sketched for this phase (see `docs/16`'s parity audit, which is what corrected the design before any code was written).

The core discipline is **progressive disclosure**: the system prompt gets a one-line index of what skills exist, never their full content. The model decides, per task, whether a skill is relevant, and reads that specific `SKILL.md` on demand — the same way it reads any other project file. Skills that are never relevant to what you're doing cost nothing; they don't bloat every prompt just by existing in the project.

## Format (`SKILL.md`)

```markdown
---
name: commit-message
description: Write a well-formatted git commit message following Conventional Commits style. Use when the user asks to commit changes or write a commit message.
allowed-tools: run_bash
---

# Commit Message Skill

When writing a commit message:
1. Run `git diff --staged` to see what actually changed.
2. Use Conventional Commits format: `type(scope): summary`
...
```

- `name`, `description` — required. `description` is what actually goes into the system prompt index, so it needs to say both *what* the skill does and *when* to use it — that's the model's only signal for whether to bother reading further.
- `allowed-tools` — optional, comma-separated. Parsed and stored now, **not enforced yet** — it needs Phase 5 (permission rules) to have a real enforcement point. Storing it early means Phase 5 doesn't need to touch the Skills format at all when it lands.
- Everything after the closing `---` is the skill body — free-form markdown, read in full only when the model opens the file.

## Discovery (`.codeagent/skills/<name>/SKILL.md`)

Project-scoped only for v1 (`src/skills/discover.js`) — same reasoning as Hooks (`docs/17`): personal (`~/.codeagent/skills`) and plugin-bundled skills are deferred to the Plugins phase, which is where a real multi-scope loading story belongs, not bolted on early to something not yet proven. Two examples ship with this project itself (`.codeagent/skills/commit-message/`, `.codeagent/skills/code-review/`) — both real, usable skills and discovery test fixtures, per PLAN.md's "start smaller, validate the shape works" guidance (not the six originally sketched).

A skill folder with no `SKILL.md`, or with malformed/incomplete frontmatter, is skipped with a warning, never thrown — one broken skill must not take down every other skill, or the agent entirely.

**Fixed alongside this:** `.gitignore` used to blanket-ignore the entire `.codeagent/` directory, which would have silently made skills un-shareable the moment anyone tried to commit one — and had already been doing exactly that to `hooks.json` since Phase 3, unnoticed. Real local state (session history, undo data) lives in `~/.codeagent/sessions` — the user's home directory, never inside a project's repo in the first place — so there was nothing under a project's `.codeagent/` that actually needed excluding. See `.gitignore`'s comment for the full explanation.

## Where this plugs in (`src/agent/systemPrompt.js`)

`buildSystemPrompt` takes an optional `skillsIndex` string (built via `SkillRegistry.formatIndexForPrompt()`), rendered in a fixed position: after the admin system prompt (`docs/18`), before project context. `SkillRegistry` is constructed once per session (same caching pattern as project context) in both `cli/index.js`'s one-shot path and `repl.js`'s interactive loop.

No new tool was needed to let the model actually read a skill. `.codeagent/skills/<name>/SKILL.md` is just an ordinary project-relative path, and `read_file` has no path restriction of its own to work around (path guarding, `src/tools/pathGuard.js`, only applies to writes) — this was an open question in PLAN.md's original task list ("check whether this needs a dedicated tool at all before building one"), and the answer is no.

`codeagent skills` lists what's discovered — read-only, matching the same "visibility command before any install machinery" pattern `codeagent hooks` established.

## What this doesn't do

- No `allowed-tools` enforcement yet — parsed and carried through, inert until Phase 5.
- No personal (`~/.codeagent/skills`) or plugin-bundled skills — deliberately deferred to the Plugins phase (`docs/16`).
- No `codeagent skills install <path>` — nothing to distribute from yet; that's what Plugins will actually be for.
- No re-scanning mid-session — skills are discovered once per session, same as project context. Adding a skill while a session is running means starting a new session to see it.

## Testing this layer

- `test/skills/frontmatter.test.js` — the parser's contract: well-formed input, every malformed-input error path, CRLF handling, colons inside description values.
- `test/skills/discover.test.js` — discovery against real temp-directory fixtures: multiple skills, missing `SKILL.md`, malformed frontmatter, missing required fields — and an explicit assertion that the returned index never contains skill body text (the progressive-disclosure guarantee, checked directly rather than assumed).
- `test/skills/registry.test.js` — `list`/`has`/`get`, and `formatIndexForPrompt`'s null-when-empty behavior.
- `test/agent/systemPrompt.test.js` — the skills section's position (after admin prompt, before project context) and that it's omitted entirely when there's nothing to show.
