/**
 * --yolo is explicit and per-invocation (or an explicit config setting) —
 * never a silently-inherited default. When active, destructive calls skip
 * the interactive prompt, but every bypass is still logged for an audit
 * trail (doc 07).
 *
 * Autonomous Mode (docs/31) reuses this exact same bypass path rather
 * than writing a second one — `autonomousMode: true` implies the same
 * auto-approve behavior `yolo: true` already provides, whether it came
 * from the `--autonomous` CLI flag (which sets both) or a standing
 * `config.autonomousMode` in a config file on its own.
 */
export function shouldBypassConfirmation(config) {
  return Boolean(config.yolo) || Boolean(config.autonomousMode);
}

export function logBypass(logger, { toolName, input }) {
  logger?.info(`--yolo bypass: ${toolName}`, { toolName, input, timestamp: new Date().toISOString() });
}
