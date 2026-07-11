/**
 * --yolo is explicit and per-invocation (or an explicit config setting) —
 * never a silently-inherited default. When active, destructive calls skip
 * the interactive prompt, but every bypass is still logged for an audit
 * trail (doc 07).
 */
export function shouldBypassConfirmation(config) {
  return Boolean(config.yolo);
}

export function logBypass(logger, { toolName, input }) {
  logger?.info(`--yolo bypass: ${toolName}`, { toolName, input, timestamp: new Date().toISOString() });
}
