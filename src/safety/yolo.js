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

const PLATFORM_LABELS = { win32: "Windows", darwin: "macOS", linux: "Linux" };

/**
 * run_bash is only confined (docs/15) where bubblewrap (Linux) or
 * sandbox-exec (macOS) exists. Elsewhere, including all of Windows, the one
 * thing standing between a command and the whole filesystem is the
 * confirmation prompt, and --yolo / Autonomous Mode remove exactly that.
 * Returns the notice to show when both are true, otherwise null.
 *
 * @param {object} config
 * @param {{sandboxKind: string, platform?: string}} env  sandboxKind: "bubblewrap" | "sandbox-exec" | "none"
 */
export function describeUnsandboxedBypass(config, { sandboxKind, platform = process.platform }) {
  if (!shouldBypassConfirmation(config)) return null;
  const sandboxOff = config.sandboxMode === "off";
  if (sandboxKind !== "none" && !sandboxOff) return null;

  const mode = config.autonomousMode ? "Autonomous Mode" : "--yolo";
  const label = PLATFORM_LABELS[platform] || platform;
  const why = sandboxOff ? "sandboxMode is set to off" : `there is no run_bash sandbox on ${label}`;
  return `Warning: ${mode} skips confirmation and ${why}, so shell commands can change anything your user account can. Use it only in a project you trust and keep under version control.`;
}

