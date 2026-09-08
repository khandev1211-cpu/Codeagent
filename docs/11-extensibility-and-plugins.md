# 11 — Extensibility & Plugins

## Core principle

Every extension point in this project exists so that adding a capability is **additive** — a new file plus a one-line registration — rather than requiring changes to the orchestrator, provider layer, or safety layer. This doc is the single reference for "how do I add X" across every extensible part of the system.

## Adding a new tool

1. Create a new file in `src/tools/`, matching the shape in doc 05 (name, description, input_schema, destructive flag, execute).
2. Add one line to `src/tools/index.js` registering it.
3. Write a test for the tool in isolation (its `execute()` function, not the whole loop) — doc 12.

Nothing in `src/agent/orchestrator.js`, `src/providers/`, or `src/safety/` needs to change. If the new tool is destructive, it's automatically gated by the existing Safety Layer purely by setting `destructive: true` — no new safety code required unless the tool introduces a genuinely new *category* of risk (see the network-access example in doc 05, which explicitly calls out that such a tool would need dedicated safety design, not just the generic flag).

## Adding a new provider

1. Create a new adapter in `src/providers/` implementing the `Provider` interface from doc 06 (`send`, `stream`, `countTokens`).
2. Add one `case` to the factory in `src/providers/index.js`.
3. Add the new provider name to the config schema's enum (doc 09) so it validates correctly.

The orchestrator's loop (doc 04) is entirely provider-agnostic already, so no changes there. Tests for the new adapter follow the same "test against recorded/mocked responses" approach as the Anthropic adapter (doc 06).

## Adding a plugin system (future, not v1)

If/when third-party or user-authored tools become a real need (beyond what's maintained in this repo directly), the natural extension of the existing tool-module shape is a plugin loader that:
- Scans a configured directory (or `node_modules` packages matching a naming convention, e.g. `codeagent-plugin-*`) for modules matching the same tool shape from doc 05.
- Registers them into the same Tool Registry used for built-in tools — no separate registration mechanism, so plugin tools and built-in tools are indistinguishable to the orchestrator and Safety Layer.
- Requires plugin tools to declare `destructive` just like built-ins — a plugin cannot opt itself out of the Safety Layer.

This is explicitly deferred rather than built in v1, because the tool-module shape needs to prove stable through real usage (adding the 6 core tools, doc 05) before it's frozen into a public plugin contract that third parties might depend on.

## Adding new config options

1. Add the field to `ConfigSchema` in `src/config/schema.js` (doc 09) with a sensible default so existing configs don't break.
2. Read it wherever it's needed via the already-resolved config object — never re-read raw config files from a new location.

## What is *not* meant to be extended lightly

- **The core loop's five-step cycle** (doc 04) — this is the stable contract everything else is built against. Changes here ripple into every layer above it and should be treated as a breaking architectural change, not a routine extension.
- **The Safety Layer's requirement that destructive calls are gated** (doc 07) — this is a project invariant, not a configurable behavior, aside from the explicit `--yolo` escape hatch that already exists.

## Guiding test for any new extension

Before adding something new, ask: *does this require touching orchestrator.js, base.js (the provider interface), or policy.js (the safety classification logic)?* If yes, it's not really "adding a tool/provider/config option" in the intended sense — it's a change to the core contract, and should be designed and reviewed as such, not slipped in as a routine addition.

## Hooks: a fourth extension surface (doc 17)

Phase 3 (doc 16) added a fourth kind of extension point alongside tools/providers/config: lifecycle hooks (`src/hooks/`), configured via `.codeagent/hooks.json`. This *did* touch `orchestrator.js` — per the guiding test above, that made it a deliberate core-contract change, not a routine addition, which is why it went through the audit and phased-plan process in `docs/16`/`PLAN.md` rather than landing as an ordinary PR. The change itself stayed additive within that review: `Orchestrator` gained an optional `hookRegistry` dependency (defaulting to a no-op), and two new invocation points in the existing loop — no restructuring of the loop's shape. See doc 17 for the full contract.

Skills (Phase 4) — the second extension surface built after Hooks — deliberately did **not** need a new tool or a new registration mechanism: `.codeagent/skills/<name>/SKILL.md` are ordinary project files, discoverable and readable through the existing `read_file` tool. Its only orchestrator-adjacent touch point is `systemPrompt.js` gaining an optional `skillsIndex` section — `orchestrator.js` itself is untouched, so per the guiding test above this stayed a routine addition, not a core-contract change the way Hooks was. See doc 19.

Subagents (Phase 6) and Plugins (Phase 8) are expected to build on the Hooks foundation rather than each inventing their own extension mechanism.

## Subagents: reusing the core loop itself, not the Hooks foundation (doc 22)

Subagents (Phase 6, shipped) took a different path than the "expected" one stated above when this doc was first written: rather than building on Hooks' `hookRegistry`-dependency pattern, `Orchestrator._runSubagentTurn` constructs a *second, scoped instance of `Orchestrator` itself* — reusing the parent's `provider`/`confirm`/`hookRegistry`/`permissionRules`/`contextManager` directly, not copies — so every safety mechanism composes for free rather than needing a parallel implementation. The only orchestrator-adjacent touch points were a new optional `subagentRegistry` constructor dependency (same no-op-default pattern Hooks established) and a new `run_subagent` tool (an ordinary tool, per the "adding a new tool" section above — `destructive: false`, since the subagent's own destructive calls are independently gated). See doc 22 for the full design.

## MCP: a new tool *source*, not a new registration mechanism (doc 25)

MCP (Phase 7, shipped) is the clearest validation of this doc's core principle: an MCP tool, once discovered from a connected server, is wrapped (`src/mcp/wrapTool.js`) into the *exact same* `{name, description, input_schema, destructive, execute}` shape every built-in tool already uses, then `toolRegistry.register()`-ed identically. `orchestrator.js` needed zero changes — an MCP tool is indistinguishable from a built-in one anywhere in the dispatch path, which is precisely what "adding a new tool" above already describes, just with the tool's origin being a subprocess server instead of a file in `src/tools/`. `mcp__<server>__<tool>` naming and a conservative `destructive: true` default (unless a server's `readOnlyHint` annotation clears the bar) are the only MCP-specific pieces — everything downstream of registration is the same code path every other tool goes through.

## Plugins: now unblocked, not speculative (doc 16, Phase 8)

The "future, not v1" framing above was written when tools were the only real extension surface. That's no longer true — Hooks, Skills, Subagents, and MCP have all since shipped as real, exercised extension points, which is exactly the precondition this doc's plugin section named for building a plugin *bundling* format: a plugin packages some combination of these four, plus a manifest, for distribution. Building a plugin system before any of the four existed would have shipped an empty container with nothing to bundle — that's no longer the case, and Phase 8 (PLAN.md) is the next real item on the roadmap for exactly this reason.
