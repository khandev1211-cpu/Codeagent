# 29 — Agent SDK (codeagent-as-a-library)

Tier 2, Phase 9.4 — the last Tier 2 item, deliberately. `docs/11`'s own stated condition for this — "only worth it once the core loop + skills/subagents/hooks are stable enough to freeze into a public API" — is met for the first time only now that all of Tier 1 has shipped. Freezing this surface before Subagents/MCP/Sandboxing existed would have meant an SDK that needed breaking changes almost immediately to add them.

## A curated surface, not a re-export of `src/`

`src/sdk/index.js` exports a deliberately audited subset — every export was individually checked against "would I commit to this shape long term," per PLAN.md's stated bar, not blanket re-exported. Importable as `codeagent/sdk`:

```js
import { Orchestrator, ToolRegistry, createDefaultRegistry } from "codeagent/sdk";
```

Deep-importing an internal path (`codeagent/src/agent/orchestrator.js`) still works at the filesystem level but is **not** covered by anything in this document — only what's actually exported from `codeagent/sdk` is the contract. `package.json`'s `exports` field only defines the `./sdk` subpath (no `.` root export), so `import "codeagent"` with no subpath is a hard `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than silently resolving to something — a consumer is never left guessing whether they found the "real" entry point.

## What's in it, and why each piece made the cut

| Category | Exports | Why |
|---|---|---|
| Core loop | `Orchestrator`, `ContextManager`, `buildProjectContext`, `buildSystemPrompt` | The actual agentic loop — the whole point of embedding this |
| Tools | `ToolRegistry`, `createDefaultRegistry` | Construct a scoped or full tool set for a session |
| Providers | `getProvider`, `resolveApiKey`, `ModelRegistry` | Wire up an LLM backend without depending on the CLI's provider-selection UI |
| Sessions | `SessionStore`, `DiffTracker` | Persistence and undo, usable standalone |
| Safety | `createConfirmer`, `loadPermissionRules`, `evaluatePermissionRules`, `isDestructive` | See "the confirm contract" below |
| Extensibility | `SkillRegistry`, `SubagentRegistry`, `HookRegistry`, `NULL_HOOK_REGISTRY`, `HOOK_EVENTS`, `loadHooksConfig` | All optional — `Orchestrator` works with none of them constructed |
| MCP | `connectAllMcpServers`, `closeAllMcpClients` | External tool servers, independent of the CLI's `.codeagent/mcp.json` discovery if a consumer wants to supply server configs programmatically |
| Config | `loadConfig`, `ConfigSchema` | Reuse the exact same validation a hand-edited `.codeagentrc` gets |
| Usage | `UsageTracker`, `recordTurnUsage` | Cost tracking, independent of the CLI's `codeagent usage` command |

## The confirm contract

`createConfirmer` is codeagent's own terminal-prompt implementation of the confirm contract — exported as a convenience, **not** the only valid one. `Orchestrator` expects any function matching:

```js
async (tool, input) => ({ allowed: boolean, reason?: string, ... })
```

A consumer embedding codeagent in a non-terminal context (a web UI, a Slack bot, a fully automated pipeline) is expected to supply their **own** `confirm` function — a modal dialog, a Slack approval message, an always-allow policy for a sandboxed CI job, whatever fits their surface. This is the single most important thing for an embedder to understand: the Safety Layer's *mechanism* (every destructive tool call routes through `confirm`) is fixed and non-optional, but the *policy* (what actually decides `allowed`) is entirely pluggable. `createConfirmer`'s terminal-prompt behavior is one policy among many, not a hardcoded requirement.

## Stability contract

- **`SDK_VERSION`** (a plain string constant, e.g. `"1.0.0"`) is independent of `package.json`'s own version. The CLI can ship many non-breaking releases — new commands, bug fixes, new built-in tools — without `SDK_VERSION` changing at all. Bumping `SDK_VERSION`'s major segment is the actual signal that something in the exported surface changed shape.
- **A breaking change to `src/sdk/index.js`** — removing an export, changing a constructor's required options, changing a method's return shape — requires a major-version bump of `SDK_VERSION`, decided and documented *before* the change ships, not discovered after the fact by a consumer's code breaking.
- **Internal refactors that don't change the exported shape** (e.g. reorganizing `src/agent/orchestrator.js`'s internals while `Orchestrator`'s public constructor options and `runTurn()`/`setProvider()` signatures stay the same) are not breaking changes to this contract, even though `package.json`'s own version might still bump for the CLI's sake.
- **New exports added to `src/sdk/index.js`** are additive, not breaking — no `SDK_VERSION` major bump required, though a minor bump is reasonable practice to signal "something new is available."

## Verifying the packaging actually works, not just the module graph

Every other test that touches SDK exports imports `src/sdk/index.js` via a relative path — which proves the internal module graph resolves, but proves **nothing** about `package.json`'s `exports` field itself, since a relative import bypasses Node's package-resolution algorithm entirely. `test/sdk/packaging.integration.test.js` instead runs `npm pack` against the real repository (round-tripping through the exact `files` allowlist an actual `npm publish` would use — critically, unlike installing the raw source directory, this would catch a real bug like `src/sdk/` accidentally being excluded from `files`), installs the resulting tarball into a throwaway consumer project via `npm install <tarball>`, and runs real subprocess scripts that `import { Orchestrator } from "codeagent/sdk"` exactly as an external user would — including a full, real `Orchestrator.runTurn()` execution against a fake provider, entirely through the packaged SDK, with zero CLI code involved.

## What this doesn't do (v1)

- **No TypeScript type definitions.** The SDK is plain JS with JSDoc-quality comments in `src/sdk/index.js` itself, not a published `.d.ts` file. Worth adding once there's real external usage to learn from about which types actually need documenting precisely, rather than speculatively typing the whole surface now.
- **No CommonJS build.** `codeagent` is an ESM-only package (`"type": "module"`); a CommonJS consumer would need their own interop (dynamic `import()`), not a dual-format build maintained here.
- **No SDK-specific documentation site or examples repo** — this doc plus `src/sdk/index.js`'s own inline comments are the documentation for now. A dedicated examples repo is worth doing once there's a second real consumer to write examples *for*, not speculatively for zero.
