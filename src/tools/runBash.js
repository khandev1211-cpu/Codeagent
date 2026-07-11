import { spawn } from "node:child_process";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 120_000;

function pickShell() {
  if (process.platform === "win32") {
    return { cmd: "cmd.exe", flag: "/c" };
  }
  return { cmd: process.env.SHELL || "/bin/sh", flag: "-c" };
}

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
    const { cmd, flag } = pickShell();
    const timeoutMs = ctx.config?.bashTimeoutMs || DEFAULT_TIMEOUT_MS;

    return new Promise((resolve) => {
      const proc = spawn(cmd, [flag, input.command], { cwd: workingDir });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
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
        });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({ ok: false, error: err.message });
      });
    });
  },
};
