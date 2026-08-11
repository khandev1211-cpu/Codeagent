# codeagent — Documentation Index

This is the full documentation set for **codeagent**, a terminal-native AI coding agent distributed as an npm package. Twenty-two documents, each owning one concern so nothing is duplicated across files. The set has grown alongside the project — Hooks, Skills, Permission Rules, Plan Mode, the Rich TUI, and Subagents each earned their own doc as they shipped.

| # | Document | Covers |
|---|---|---|
| 01 | [Overview](./01-overview.md) | Vision, goals, target users, non-goals |
| 02 | [System Architecture](./02-system-architecture.md) | Full module map, data flow, high-level diagram |
| 03 | [Package Structure](./03-package-structure.md) | Folder layout, package.json shape, bin config |
| 04 | [Agent Core & Loop](./04-agent-core-and-loop.md) | The orchestrator loop, iteration/cost limits |
| 05 | [Tools](./05-tools.md) | Every tool's schema, contract, and behavior |
| 06 | [Provider Layer](./06-provider-layer.md) | LLM abstraction + Anthropic adapter |
| 07 | [Safety & Permissions](./07-safety-and-permissions.md) | Destructive-op policy, confirmations, `--yolo` |
| 08 | [Context & Session Management](./08-context-and-session-management.md) | Context window handling, persistence, undo |
| 09 | [Configuration](./09-configuration.md) | Layered config system, schema, env vars |
| 10 | [CLI & UX](./10-cli-and-ux.md) | Commands, flags, REPL behavior, output |
| 11 | [Extensibility & Plugins](./11-extensibility-and-plugins.md) | Adding tools/providers without touching core |
| 12 | [Testing & QA](./12-testing-and-quality-assurance.md) | Test strategy per module, CI gates |
| 13 | [Deployment, Publishing & Versioning](./13-deployment-publishing-and-versioning.md) | npm publish pipeline, semver, changelog |
| 14 | [Support, Maintenance & Roadmap](./14-support-maintenance-and-roadmap.md) | Issue triage, support channels, roadmap |
| 15 | [Security & Privacy](./15-security-and-privacy.md) | API key handling, sandboxing, telemetry stance |
| 16 | [Claude Code Parity Audit](./16-claude-code-parity-audit.md) | Feature-by-feature audit vs. current Claude Code; drives PLAN.md's phase order |
| 17 | [Hooks](./17-hooks.md) | Lifecycle event system — PreToolUse/PostToolUse/SessionStart/SessionEnd, `.codeagent/hooks.json` |
| 18 | [Provider Management & Admin Prompt](./18-provider-management-and-admin-prompt.md) | Multi-provider config, persisted setup, first-run detection, shared history across providers, admin system prompt |
| 19 | [Skills](./19-skills.md) | `SKILL.md` discovery, progressive disclosure, `.codeagent/skills/` |
| 20 | [Permission Rules & Plan Mode](./20-permission-rules-and-plan-mode.md) | Fine-grained allow/deny rules, `--plan` read-only execution mode, precedence order with Hooks and Safety |
| 21 | [Rich TUI](./21-rich-tui.md) | Ink-based interactive session — status header, mid-session model switcher, `Orchestrator.setProvider()` |
| 22 | [Subagents](./22-subagents.md) | Design writeup for Phase 6 — isolated child agents, tool-subset restriction, synchronous execution, `run_subagent` tool |

## Additional project documentation

Beyond the `docs/` set, these root-level documents supplement the architecture docs:

| Document | Covers |
|---|---|
| [`PLAN.md`](../PLAN.md) | Phase-by-phase implementation plan and roadmap |
| [`implementation_plan.md`](../implementation_plan.md) | Claude Code parity roadmap — Project Memory, Slash Commands, Subagents, MCP client, Plugins, Web Tools & sandboxing |
| [`external_plugin_plan.md`](../external_plugin_plan.md) | External plugin installation plan — `codeagent plugin install`, manifest schema, security model |
| [`GEMMA4-HACKATHON-SETUP.md`](../GEMMA4-HACKATHON-SETUP.md) | Hackathon guide for running Gemma 4 locally via Ollama with codeagent |

## How to use this set

- **Building the project for the first time?** Read 01 → 02 → 03 → 04, then implement tools per 05 in the build order given in doc 04.
- **Adding a new tool or provider?** Read 11 first — it exists specifically so you don't need to touch the orchestrator.
- **Preparing a release?** Read 12 and 13 in order.
- **Onboarding a contributor?** Point them at 01, 02, and 14.

## Assumptions carried through every doc

- Package name: `codeagent` (existing project, this is the v2/full architecture pass).
- Runtime: Node.js, ESM.
- Default LLM provider: Anthropic API (`/v1/messages`, tool use).
- Distribution: npm, global install or `npx`.

If any of these are wrong, only docs 03, 06, and 13 need edits — the rest of the set doesn't reference the assumption directly.