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

Skills (Phase 4), Subagents (Phase 6), and Plugins (Phase 8) are expected to build on this same hooks foundation rather than each inventing their own extension mechanism.
