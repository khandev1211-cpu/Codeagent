# 23 — Memory (`AGENTS.md`)

The CLAUDE.md-equivalent gap named in `docs/16`'s Tier 1 parity audit: a discoverable, user-authored instruction file, auto-loaded every session — distinct from `customSystemPromptAddendum`/`adminSystemPrompt` (`docs/18`), which are single config-string values set via a CLI command, not a file the team commits to the repo and edits directly like a README.

## Two levels, v1 scope

- **Project**: `AGENTS.md` at the repo root — deliberately *not* hidden under `.codeagent/`, unlike Hooks config, Skills, or Subagent definitions. Those are tool-internal configuration; this is meant to be as visible and directly editable as `README.md`, which is exactly why `context.js` already auto-discovers a README the same way. `AGENTS.md` at the repo root also happens to be an emerging cross-tool convention (multiple coding agents have converged on this filename) — using it rather than inventing a codeagent-specific name means a file a team already maintains for one tool works here too, for free.
- **Global**: `~/.codeagent/AGENTS.md` — personal, cross-project preferences (e.g. "always explain your reasoning before editing," "I prefer functional style"), consistent with the existing `~/.codeagentrc` global-config location.

Both are loaded every session (`src/agent/memory.js`'s `loadMemory()`), rendered into the system prompt global-first-then-project (`formatMemoryForPrompt()`) — broad personal preferences before more specific project instructions, the same "broad context first, specific after" ordering the system prompt already uses elsewhere (admin prompt before skills before project context).

## Where it sits in the system prompt

Between the admin prompt and the skills index — deliberately, not incidentally:

- **Below the admin prompt**: the admin prompt (`docs/18`) is operator-set, machine-wide, and explicitly "priority" over everything else in the prompt. Memory is user/team-authored per-project content, a level down from that.
- **Above skills/subagents/project context**: it's curated, intentional instruction — closer in spirit to the admin prompt than to the auto-generated project tree or README excerpt below it, which have no editorial voice at all.

Like every other optional system-prompt section here (skills index, subagents index), memory content is never invented or summarized — it's the file's contents, verbatim (up to the char cap), or the section doesn't appear at all.

## What's deliberately not built (v1)

- **No nested/directory-layered discovery.** Real Claude Code walks up from the current working file's directory picking up every `CLAUDE.md` along the way, so a subdirectory can add or override instructions for just that part of a codebase. codeagent's session model has one `cwd` for the whole session (not a per-file-operation directory), so there's no natural place to plug per-directory layering in without inventing a new concept the orchestrator doesn't otherwise have. Worth revisiting if per-directory instructions become a real, demonstrated need — not built now on spec.
- **No `@import` syntax.** Real Claude Code lets a `CLAUDE.md` reference other files inline. A single flat file (per level) is the smallest version of this feature that's actually useful and provable; import resolution (circular-reference handling, relative path rules, recursive char-cap accounting) is meaningfully more complexity for a need not yet demonstrated.
- **No write/edit tooling.** The model can `read_file`/`edit_file` `AGENTS.md` like any other project file if the user asks it to update its own instructions — no dedicated `update_memory` tool was needed for that, same reasoning `docs/19` used for Skills: don't build a dedicated tool for something an existing general-purpose tool already covers.
- **No enforcement that memory content is followed.** Same caveat the admin-prompt section's own wording already states explicitly: it "doesn't override the tool-use conventions... or the Safety Layer (enforced in code, independent of any system prompt content)." Memory is guidance the model is told to take seriously, not a mechanism with code-level teeth — that distinction matters and shouldn't be blurred by this feature's naming.

## Visibility

`codeagent memory` lists what's actually loaded for the current session (path, character count, or "not found" for each level) — mirrors the same visibility-before-any-install-machinery pattern `codeagent hooks`/`codeagent skills`/`codeagent subagents` already established, so a user isn't left guessing whether their `AGENTS.md` is actually being picked up.
