/**
 * Addresses the PLAN.md gap: "a PreToolUse hook that can silently
 * auto-approve is a new bypass surface; needs the same 'every bypass is
 * logged' principle docs/07 already applies to --yolo." Hooks can't
 * actually auto-approve — that's structurally impossible, PreToolUse can
 * only veto (docs/17) — but the asymmetry this was really pointing at is
 * logging: --yolo's every bypass goes through logBypass (src/safety/
 * yolo.js) into the persistent logger, while a hook block previously only
 * reached onEvent, a live-UI callback nothing persists once the session
 * ends. This closes that gap with a matching, persistent audit entry —
 * same fields (tool, input, timestamp), same shape, different verb (a
 * hook *blocking* something is exactly as worth an audit trail as --yolo
 * *bypassing* something).
 */
export function logHookBlock(logger, { event, toolName, input, reason, level = "info" }) {
  const logFn = (level === "warn" ? logger?.warn : logger?.info)?.bind(logger);
  logFn?.(`Hook blocked ${event}: ${toolName}`, {
    event,
    toolName,
    input,
    reason,
    timestamp: new Date().toISOString(),
  });
}
