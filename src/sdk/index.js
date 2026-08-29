/**
 * The Agent SDK (docs/29, Tier 2 Phase 9.4) — a deliberately curated
 * subset of internals, not a blanket re-export of `src/`. Every export
 * here was individually audited for "would I commit to this shape long
 * term," per PLAN.md's stated bar for this item. Import from
 * `codeagent/sdk`, not from internal paths under `codeagent/src/*` —
 * only this file's exports are covered by the stability contract
 * (docs/29); anything reached by deep-importing a source path can change
 * or move without notice.
 *
 * This surface only exists now because it could only be frozen now:
 * Subagents, MCP, and Sandboxing all needed to exist first, or the SDK
 * would have needed breaking changes almost immediately to add them
 * (docs/11's own stated condition for this item, met for the first time
 * once all of Tier 1 shipped).
 */

// Core agent loop
export { Orchestrator } from "../agent/orchestrator.js";
export { ContextManager, buildProjectContext } from "../agent/context.js";
export { buildSystemPrompt } from "../agent/systemPrompt.js";

// Tools
export { ToolRegistry } from "../tools/registry.js";
export { createDefaultRegistry } from "../tools/index.js";

// Providers (LLM backends)
export { getProvider } from "../providers/index.js";
export { resolveApiKey } from "../providers/resolveApiKey.js";
export { ModelRegistry } from "../providers/modelRegistry.js";

// Sessions
export { SessionStore } from "../session/store.js";
export { DiffTracker } from "../session/diffTracker.js";

// Safety layer — confirm/permissionRules/policy are the actual
// enforcement mechanisms; createConfirmer is codeagent's own
// terminal-prompt implementation of the confirm contract, exported as a
// convenience, NOT the only valid one. A library consumer embedding
// codeagent in a non-terminal context (a web UI, a bot) is expected to
// supply their own `confirm` function matching the same
// `async (tool, input) => ({ allowed, ... })` shape Orchestrator expects
// — see docs/29 for the full contract documentation.
export { createConfirmer } from "../safety/confirm.js";
export { loadPermissionRules, evaluatePermissionRules } from "../safety/permissionRules.js";
export { isDestructive } from "../safety/policy.js";

// Extensibility registries — Skills, Subagents, Hooks, all optional
// (Orchestrator works fine with none of them constructed)
export { SkillRegistry } from "../skills/registry.js";
export { SubagentRegistry } from "../agent/subagentRegistry.js";
export { HookRegistry, NULL_HOOK_REGISTRY, HOOK_EVENTS, loadHooksConfig } from "../hooks/index.js";

// MCP client
export { connectAllMcpServers, closeAllMcpClients } from "../mcp/index.js";

// Config
export { loadConfig } from "../config/loader.js";
export { ConfigSchema } from "../config/schema.js";

// Usage tracking
export { UsageTracker, recordTurnUsage } from "../utils/usageTracker.js";

/**
 * Independent of package.json's own version — the CLI can ship many
 * non-breaking releases (new commands, bug fixes) without this exported
 * surface changing at all. Bumping THIS number is the actual signal that
 * something in the list above changed shape; see docs/29's stability
 * contract for what counts as a breaking change here specifically.
 */
export const SDK_VERSION = "1.0.0";
