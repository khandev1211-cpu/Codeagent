# 01 — Overview

## What codeagent is

`codeagent` is a terminal-native AI coding agent, installed as an npm package, that reads and writes files, searches codebases, and runs shell commands on a developer's behalf — driven by an LLM that decides which tools to call and when. It's built to work the way Claude Code works: you describe a goal in plain language, the agent plans and executes multi-step changes to your project, and you stay in control of anything destructive.

## Who it's for

- Solo developers and small teams who want an agentic assistant living in their terminal rather than a separate IDE plugin.
- Users who already work across multiple stacks in one session (the kind of workflow where you're touching Python, Node, and shell scripts in the same sitting) and don't want to context-switch tools.
- Developers comfortable approving/declining actions interactively, at least until they trust the agent enough to reach for `--yolo`.

## Goals

1. **Genuinely agentic, not just chat-with-code-blocks.** The agent calls tools directly — it edits files and runs commands rather than printing a diff for you to paste.
2. **Safe by default.** Every destructive action requires confirmation unless explicitly bypassed.
3. **Provider-agnostic core.** Anthropic is the default and primary target, but the core loop shouldn't be rewritten if another provider is added later.
4. **Good CLI citizenship.** Fast startup, clear output, sane exit codes, works in scripts and CI as well as interactively.
5. **Extensible without surgery.** New tools, new providers, and new config options should be additive, not require touching the orchestrator.

## Non-goals

- **Not an IDE.** No GUI, no editor plugin (at least not in this package — that could be a separate downstream package built on the same core).
- **Not a multi-agent framework.** One agent, one conversation at a time. Multi-agent orchestration (if ever wanted) is future scope, not v1.
- **Not trying to replace version control.** codeagent tracks its own edits for undo purposes (doc 08) but is not a substitute for `git`; users should still commit their work normally.
- **Not a hosted service.** This is a local CLI tool talking directly to the Anthropic API with the user's own key — no codeagent-run backend in the loop.

## Success criteria for v1

- Install via `npm install -g codeagent` or `npx codeagent`, run `codeagent` in any project directory, get a working REPL immediately.
- Ask it to make a real multi-file change; it reads relevant files, proposes/executes edits with confirmation, and the change actually works.
- Kill the process mid-task and resume the session later without losing context.
- Run with `--yolo` in a CI/script context and have it complete unattended.
- No API key or secret ever appears in logs, session files, or committed config.

See doc 02 for how these goals map to actual modules.
