import { runHook } from "./runHook.js";
import { hookMatches } from "./matcher.js";
import { loadHooksConfig } from "./loadHooksConfig.js";

/**
 * Registers and runs hooks for lifecycle events (doc 16 / PLAN.md Phase 3).
 * Project-scoped only for v1 — loads .codeagent/hooks.json once at
 * construction; pass `hooksConfig` directly to skip disk I/O (tests, or a
 * caller that's already loaded/merged config elsewhere).
 */
export class HookRegistry {
  constructor({ cwd = process.cwd(), logger, hooksConfig } = {}) {
    this.cwd = cwd;
    this.logger = logger;
    this._hooks = (hooksConfig || loadHooksConfig({ cwd })).hooks || {};
  }

  has(event) {
    return Array.isArray(this._hooks[event]) && this._hooks[event].length > 0;
  }

  /**
   * Runs every hook registered for `event` whose matcher applies to
   * payload.tool (matcher is ignored for events with no tool, e.g.
   * SessionStart/SessionEnd). Never throws — a broken hooks.json entry or a
   * failing hook script degrades to "no hooks ran," never a crashed turn.
   *
   * Returns:
   *   - blocked: true if any hook for this event exited 2. The *caller*
   *     decides whether "blocked" is enforceable for this event — for
   *     PreToolUse it stops the tool call; for PostToolUse/SessionStart/
   *     SessionEnd there's nothing left to block, so the caller should log
   *     it, not act on it. This method deliberately doesn't know which
   *     events are enforceable — that's an orchestrator/CLI-layer decision,
   *     not a hooks-layer one.
   *   - reason: the blocking hook's stderr, if blocked
   *   - context: any hook-supplied context strings, newline-joined
   */
  async run(event, payload = {}) {
    const defs = (this._hooks[event] || []).filter(
      (def) => !payload.tool || hookMatches(def.matcher, payload.tool)
    );
    if (defs.length === 0) {
      return { blocked: false, reason: null, context: null };
    }

    const fullPayload = { event, timestamp: new Date().toISOString(), ...payload };
    const results = await Promise.all(
      defs.map((def) =>
        runHook(def, fullPayload, { cwd: payload.cwd || this.cwd, logger: this.logger })
      )
    );

    const blocking = results.find((r) => r.decision === "block");
    const contexts = results.map((r) => r.context).filter(Boolean);

    return {
      blocked: Boolean(blocking),
      reason: blocking?.reason || null,
      context: contexts.length ? contexts.join("\n") : null,
    };
  }
}

/** No-op registry — used wherever a HookRegistry isn't configured, so
 *  callers (orchestrator, CLI) never need an `if (hookRegistry)` check. */
export const NULL_HOOK_REGISTRY = Object.freeze({
  has: () => false,
  run: async () => ({ blocked: false, reason: null, context: null }),
});
