import { spawn } from "node:child_process";

const DEFAULT_HOOK_TIMEOUT_MS = 30_000;

function pickShell() {
  if (process.platform === "win32") {
    return { cmd: "cmd.exe", flag: "/c" };
  }
  return { cmd: process.env.SHELL || "/bin/sh", flag: "-c" };
}

/**
 * Executes one shell-command hook. v1 supports shell commands only — HTTP,
 * prompt, and agent-based hook types are a later iteration (PLAN.md Phase 3
 * explicitly scopes this down; matches runBash.js's existing subprocess
 * pattern rather than inventing a new one).
 *
 * Contract:
 *  - the event payload is written to the hook's stdin as JSON, and also
 *    exposed as CODEAGENT_EVENT / CODEAGENT_TOOL env vars for convenience
 *  - exit code 0             -> allow, no objection
 *  - exit code 2             -> block (only meaningful for PreToolUse —
 *    other events log it as a warning, since there's nothing left to block
 *    by the time they fire; see registry.js)
 *  - any other non-zero exit, a timeout, or a spawn error -> treated as a
 *    hook execution failure: logged, but never blocks the tool call. A
 *    broken hook script must not be able to silently freeze every tool call
 *    project-wide — failing open here is a deliberate choice, not an
 *    oversight.
 *  - stdout, if it parses as JSON with a string `context` field, is
 *    surfaced back to the caller as additional context (e.g. a formatter
 *    hook reporting what it changed)
 */
export function runHook(hookDef, payload, { cwd, logger, timeoutMs } = {}) {
  const { command } = hookDef;
  const effectiveTimeout = timeoutMs ?? hookDef.timeout ?? DEFAULT_HOOK_TIMEOUT_MS;
  const shell = pickShell();

  return new Promise((resolve) => {
    let settled = false;
    let proc;

    function finish(outcome) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ command, ...outcome });
    }

    try {
      proc = spawn(shell.cmd, [shell.flag, command], {
        cwd: cwd || process.cwd(),
        env: {
          ...process.env,
          CODEAGENT_EVENT: payload.event || "",
          CODEAGENT_TOOL: payload.tool || "",
        },
      });
    } catch (err) {
      logger?.warn(`Hook failed to start: ${err.message}`, { command });
      resolve({ command, decision: "error", reason: err.message, context: null });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, effectiveTimeout);

    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    proc.on("close", (code) => {
      if (timedOut) {
        logger?.warn(`Hook timed out after ${effectiveTimeout}ms: ${command}`, { event: payload.event });
        finish({ decision: "error", reason: `Hook timed out after ${effectiveTimeout}ms`, context: null });
        return;
      }

      let context = null;
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && typeof parsed.context === "string") context = parsed.context;
      } catch {
        // stdout isn't structured JSON — that's fine, it's optional.
      }

      if (code === 2) {
        finish({ decision: "block", reason: stderr.trim() || "Blocked by hook", context });
      } else if (code === 0) {
        finish({ decision: "allow", reason: null, context });
      } else {
        logger?.warn(`Hook exited with code ${code}, treating as non-blocking`, {
          command,
          stderr: stderr.trim(),
        });
        finish({ decision: "error", reason: stderr.trim() || `Hook exited with code ${code}`, context });
      }
    });

    proc.on("error", (err) => {
      logger?.warn(`Hook failed to run: ${err.message}`, { command });
      finish({ decision: "error", reason: err.message, context: null });
    });

    // A hook that exits immediately (e.g. `exit 0`) may close its stdin
    // before or during this write — that's a normal EPIPE, not a failure
    // worth surfacing; the process's own exit code is still authoritative.
    proc.stdin.on("error", () => {});
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}
