/**
 * Hook lifecycle events codeagent actually has natural seams for today
 * (PLAN.md Phase 3 / doc 16). Claude Code has on the order of 30 event
 * types — we start with the four that map directly onto real seams in
 * orchestrator.js and the CLI session lifecycle, and add more only once a
 * concrete use case needs them, not speculatively (doc 11's "additive,
 * justified by a real need" principle applies here too).
 */
export const HOOK_EVENTS = Object.freeze({
  PRE_TOOL_USE: "PreToolUse",
  POST_TOOL_USE: "PostToolUse",
  SESSION_START: "SessionStart",
  SESSION_END: "SessionEnd",
});

export const ALL_HOOK_EVENTS = Object.freeze(Object.values(HOOK_EVENTS));
