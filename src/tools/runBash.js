import { spawn } from "node:child_process";
import path from "node:path";
import { probeSandbox, wrapWithSandbox, resolveWritablePaths } from "../safety/sandbox.js";

const DEFAULT_TIMEOUT_MS = 120_000;
// Grace period between SIGTERM and SIGKILL on timeout. Needed for the
// bubblewrap case specifically: SIGKILL can't be caught or relayed, so a
// straight SIGKILL to a --unshare-pid bwrap process would orphan the
// sandboxed child (verified empirically — see sandbox.js). SIGTERM gives
// bwrap a chance to tear down the whole namespace cleanly; SIGKILL after
// this grace period is the fallback if that doesn't happen fast enough.
const KILL_GRACE_MS = 500;

function pickShell() {
  if (process.platform === "win32") {
    return { cmd: "cmd.exe", flag: "/c" };
  }
  return { cmd: process.env.SHELL || "/bin/sh", flag: "-c" };
}

let warnedUnsandboxedOnce = false;

export const runBash = {
  name: "run_bash",
  description:
    "Execute a shell command in the project (or a specified) directory. Always treated as destructive.",
  input_schema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to run" },
      cwd: { type: "string", description: "Working directory, relative to project root" },
    },
    required: ["command"],
  },
  // Always destructive regardless of the specific command — the agent can't
  // reliably pre-classify arbitrary commands as safe (doc 05 / doc 07).
  destructive: true,
  async execute(input, ctx) {
    const workingDir = path.resolve(ctx.cwd, input.cwd || ".");
    const { cmd: shellCmd, flag } = pickShell();
    const timeoutMs = ctx.config?.bashTimeoutMs || DEFAULT_TIMEOUT_MS;

    const sandboxMode = ctx.config?.sandboxMode === "off" ? "off" : "auto";
    const kind = sandboxMode === "off" ? "none" : probeSandbox();

    if (kind === "none" && sandboxMode !== "off") {
      // Logged, not silent — same "every bypass is auditable" principle
      // as --yolo (src/safety/yolo.js). Once per process, not once per
      // call: this is a fixed environment fact, not a per-command
      // decision worth repeating in the log on every single run_bash
      // invocation.
      if (!warnedUnsandboxedOnce) {
        ctx.logger?.warn(
          "run_bash: no sandbox available on this platform (bubblewrap/sandbox-exec not found) — commands run with full filesystem write access, confined only by the timeout."
        );
        warnedUnsandboxedOnce = true;
      }
    }

    const writablePaths = resolveWritablePaths({
      cwd: ctx.cwd,
      allowedWritePaths: ctx.config?.allowedWritePaths,
    });
    // The requested working directory itself must always be writable even
    // if it's outside allowedWritePaths's resolved roots (e.g. a cwd under
    // a system tmp dir for a build step) — sandboxing shouldn't silently
    // break a cwd the destructive-call confirmation already approved.
    if (!writablePaths.includes(workingDir)) writablePaths.push(workingDir);

    const { cmd, args } = wrapWithSandbox({
      kind,
      cmd: shellCmd,
      args: [flag, input.command],
      cwd: workingDir,
      writablePaths,
    });

    return new Promise((resolve) => {
      const proc = spawn(cmd, args, { cwd: workingDir });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGTERM");
        setTimeout(() => {
          try {
            proc.kill("SIGKILL");
          } catch {
            // Already exited between SIGTERM and this fallback — fine.
          }
        }, KILL_GRACE_MS);
      }, timeoutMs);

      proc.stdout.on("data", (d) => (stdout += d));
      proc.stderr.on("data", (d) => (stderr += d));

      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          ok: !timedOut && code === 0,
          exitCode: code,
          stdout,
          stderr,
          timedOut,
          sandboxed: kind !== "none",
        });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({ ok: false, error: err.message });
      });
    });
  },
};

/** Test-only: resets the once-per-process unsandboxed warning flag. */
export function _resetRunBashWarningState() {
  warnedUnsandboxedOnce = false;
}

