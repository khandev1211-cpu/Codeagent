# 16 — Claude Code Parity Audit

**Date:** 2026-07-11
**Method:** Every "codeagent has/lacks X" claim below was verified by reading the actual source in `src/` (not assumed from PLAN.md or the other docs), grepped for zero false negatives (`hook`, `mcp`, `CLAUDE.md`, `slash`, `plan.*mode`, `sandbox`, `subagent` all return no matches anywhere in `src/`). Every "Claude Code has X" claim is sourced from Anthropic's current published docs map, fetched live rather than recalled from training data, since this is exactly the kind of fast-moving product surface that goes stale.

## Scope decision, before the table

Claude Code in mid-2026 is not just a CLI agent anymore — it's a full product surface: Slack integration, a desktop app, VS Code/JetBrains extensions, Bedrock/Vertex/Foundry routing, an enterprise admin console with managed settings and analytics, a hosted "Claude Code on the web" execution environment, agent teams, remote control from mobile, computer use, gateways, compliance tooling. Chasing all of that would not be a reasonable roadmap for a single-maintainer open-source terminal tool, and most of it isn't what "same as Claude Code" actually means in practice — what it means is: *the core agentic loop feels the same, and it's extensible the same way.*

So this audit is split into three tiers. Tier 1 is the real target. Tier 3 is explicitly named so it stops being an ambient "we should probably also..." — it's a deliberate non-goal, the same way `docs/01` already declares "not an IDE" and "not a hosted service."

---

## Tier 1 — Core agentic-loop parity (the actual roadmap)

| Feature | What it means in Claude Code | Status in codeagent | Depends on |
|---|---|---|---|
| **Hooks** | Lifecycle event system — shell/HTTP/prompt/agent callbacks fired on `PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, etc.; can block, modify, or add context to a tool call. | ❌ None. No hook concept anywhere in `src/`. | Nothing — this is the foundation everything else hooks into. |
| **Skills** | Discoverable `SKILL.md` folders (personal/project/plugin-scoped) with YAML frontmatter, progressively disclosed — Claude reads the skill's instructions only when relevant, not injected into every system prompt. | ❌ None. `docs/05` uses "skills" as a loose synonym for the 6 built-in *tools*; PLAN.md Phase 3 sketches a different, simpler "config toggle + prompt addendum" model that doesn't match this. | Naming disambiguation (see `docs/05` note) before any code. |
| **Subagents** | Named, isolated-context agents with restricted tool access, invoked automatically or explicitly, for delegating research/review/debugging without polluting the main conversation. | ❌ None — and `docs/01` explicitly lists "not a multi-agent framework" as a v1 non-goal. That non-goal needs to be revisited on purpose, not overridden by drift. | Orchestrator needs to support spawning a scoped child run; today `Orchestrator.runTurn` assumes one flat history. |
| **MCP client support** | Connect external tool servers (stdio/HTTP/SSE) — databases, issue trackers, browsers — as additional tools the model can call. | ❌ None. codeagent's "providers" are LLM backends, not tool servers — there is no MCP client anywhere. This is a fully separate axis from the provider adapters that already exist. | Tool Registry already supports arbitrary tool registration (doc 11), so this is additive once an MCP client module exists. |
| **Plugins** | A *packaging and distribution* format — a plugin bundles skills + subagents + hooks + MCP servers + a manifest, installed from a marketplace (GitHub/git/npm/local path). | ❌ None. `docs/11` has a good blueprint but it's scoped only to *tools* (`codeagent-plugin-*` → Tool Registry), not the full skills+agents+hooks+MCP bundle real plugins are. | **All four of the above.** A plugin in Claude Code is a container for skills/agents/hooks/MCP — building this first would just be an empty wrapper. |
| **Permission rules / Plan Mode** | Fine-grained allow/deny rules per tool+argument pattern, plus a read-only "plan mode" that lets Claude explore and propose before any write happens. | 🟡 Partial. codeagent's safety layer (`docs/07`) is a single global `destructive: true/false` flag per tool, gated by one confirm/yolo/remember decision — no per-path or per-command rules, no read-only exploration mode distinct from "ask every time." | None — this can evolve the existing `safety/policy.js` incrementally. |
| **Memory (`CLAUDE.md` equivalent)** | Auto-loaded, directory-layered project instructions (`CLAUDE.md`, `.claude/rules/`), separate from a single global config string. | 🟡 Partial. `agent/context.js` auto-builds a project tree + `package.json` + README summary every session (a reasonable *auto-context* substitute) — but there's no user-authored, directory-scoped, persistent instruction file. `customSystemPromptAddendum` is one flat string in config, not a discoverable file. | None — additive to `context.js`/`systemPrompt.js`. |
| **Slash commands** | Reusable custom prompts as files (`/review`, `/pr-description`), project- or user-scoped, with argument substitution. | ❌ None. `commander`-based CLI commands (`setup`, `models`, etc.) exist but there's no in-REPL slash-command layer for prompt templates. | None — separate from CLI commands, lives in the REPL layer. |
| **Session fork / naming** | Resume, fork (branch into an alternate continuation), and name sessions. | 🟡 Partial. `SessionStore`/`--resume last`/`--resume <id>` exist (`docs/08`); no fork, no naming. | None. |
| **Checkpointing / rewind** | Automatic tracking of file *and* conversation state, rewindable. | 🟡 Partial. `DiffTracker`/`undo` covers file changes well (`docs/08`) but there's no conversation-state rewind, only file revert. | None. |
| **Sandboxing** | OS-level filesystem/network isolation for the Bash-equivalent tool, independent of the confirmation prompt. | ❌ None. `run_bash` (`runBash.js`) has a timeout and a cwd resolve, but no sandboxing at all — under `--yolo`, a bad command has full user-level system access. This is a real safety gap, not just a missing feature. | None — can wrap the existing `spawn` call. |
| **Output styles** | Swappable persistent response personas/formats (e.g., "explanatory," "concise"), separate from the system prompt. | ❌ None. | None. |
| **Headless structured output** | `--output-format json`/streaming JSON events for scripting, beyond plain exit codes. | 🟡 Partial. One-shot mode + exit codes exist (`docs/10`) but output is plain text, not structured JSON events. | None. |
| **Tool set breadth** | `Read/Write/Edit/Glob/Grep/Bash/WebFetch/WebSearch/NotebookEdit` + task tracking (`TodoWrite`). | 🟡 Partial by design. codeagent's 6 tools (`docs/05`) cover the file/shell surface well; `WebFetch`/`WebSearch` are a *deliberate* v1 exclusion (`docs/05`'s explicit "network access tools... needs dedicated safety design" note) — worth revisiting now that the ambition is broader, but it's a conscious decision, not an oversight. | Would need its own safety classification per doc 05's own reasoning, not just the `destructive` flag. |

---

## Tier 2 — Worth doing, lower urgency

| Feature | Notes |
|---|---|
| Usage/cost tracking (`/usage`, `/costs`) | Already scoped in PLAN.md Phase 5 — real gap, not urgent relative to Tier 1. |
| Interactive config manager | PLAN.md Phase 4 — nice-to-have once Tier 1 stabilizes config surface (permission rules, hooks config, etc. will all add new config shape first). |
| Statusline / terminal theming, vim keybindings | Polish, not core capability. |
| Agent SDK equivalent (codeagent-as-a-library) | Only worth it once the core loop + skills/subagents/hooks are stable enough to freeze into a public API — same reasoning `docs/11` already applies to the plugin tool-shape. |

## Tier 3 — Explicitly out of scope (naming it so it stops being ambient scope creep)

Enterprise/hosted infrastructure that doesn't fit a self-hosted, BYO-API-key CLI tool: Bedrock/Vertex/Foundry provider routing, LLM gateways with spend-cap enforcement, an admin console with managed/server-pushed settings, analytics/compliance dashboards, Slack/VS Code/JetBrains first-party extensions, "Claude Code on the web" hosted execution, agent teams (multiple simultaneous teammates with a lead/shutdown protocol), Remote Control from mobile, computer use, scheduled cloud routines, channels (webhook bridges). If any of these become real user requests later, they're additive to whatever Tier 1 core exists by then — none of them block Tier 1.

---

## What's already at or near parity

Worth naming so the audit doesn't read as all-gaps: the core agentic loop (`docs/04`), six real provider adapters (`docs/06`) — arguably *broader* than Claude Code's default single-provider posture — destructive-action confirmation with audit logging (`docs/07`), file-level undo (`docs/08`), resumable sessions, and the "additive extension" architecture (`docs/11`) are all solid and don't need rework. Tier 1 builds on top of this, not instead of it.

---

## Recommended build order

Not PLAN.md's original phase numbers — reordered around actual dependencies surfaced by this audit:

1. **Hooks** — foundational; nothing else in Tier 1 needs it removed later, and it's independently useful the moment it exists (e.g., auto-format after edit, block edits to protected paths).
2. **Skills** — the actual headline ask. Needs the "skills" naming collision in `docs/05` resolved first (rename the tool concept, or explicitly scope doc 05 to "Tools" only).
3. **Permission rules / Plan Mode** — evolves the existing safety layer rather than replacing it; unblocks safer experimentation with the next two items.
4. **Subagents** — requires the orchestrator to support a scoped child run; this is the one item that touches `orchestrator.js` directly, so per `docs/11`'s own "guiding test," it needs deliberate design review, not a routine addition.
5. **MCP client** — additive to the existing Tool Registry once it exists as a module.
6. **Plugins** — packaging layer over 1–5. Building this earlier would ship an empty container.
7. **Memory (CLAUDE.md-equivalent), slash commands, session fork, sandboxing** — can interleave with the above; none block or are blocked by items 1–6.

This directly supersedes PLAN.md's Phase 3 ("Skills System") ordering — PLAN.md is being updated to reflect this sequencing.
