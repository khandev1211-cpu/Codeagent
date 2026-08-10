import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SANDBOX_EXEC_BIN = "/usr/bin/sandbox-exec";

/**
 * Addresses the security gap flagged in PLAN.md / the run_bash sandboxing
 * item: run_bash previously spawned commands directly against the host
 * with no isolation beyond a timeout — full read/write access to whatever
 * the OS user running codeagent could touch, "always destructive" in name
 * only. This module confines what a shell command can *write to* the same
 * way write_file/edit_file already are (src/tools/pathGuard.js) — reads
 * remain unrestricted (many legitimate commands need to read system
 * libraries, package caches, etc.), but writes are only permitted inside
 * the project root and any configured allowedWritePaths (doc 09).
 *
 * This is not full sandboxing (no network isolation, no syscall
 * filtering) — it's the same "structural guard, not a heuristic
 * classifier" philosophy as pathGuard, extended to run_bash. Network
 * access is deliberately left untouched by default: cutting it would
 * break `npm install`, `git push`, `curl`, and similar commands that are
 * routine, legitimate parts of a coding session.
 */

function commandExists(bin) {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure decision logic, deliberately separated from the actual probing
 * (probeSandbox below) so it's testable without needing bwrap/sandbox-exec
 * actually installed — tests exercise this directly with fabricated
 * availability flags.
 */
export function decideSandboxKind({ platform, bwrapAvailable, sandboxExecAvailable }) {
  if (platform === "linux" && bwrapAvailable) return "bubblewrap";
  if (platform === "darwin" && sandboxExecAvailable) return "sandbox-exec";
  return "none";
}

let cachedKind = null;

/**
 * Real detection, cached for the process lifetime — repeated `which`
 * shellouts on every run_bash call would be wasteful, and sandbox
 * availability can't change mid-process. `forceRecheck` exists only for
 * tests.
 */
export function probeSandbox({ platform = process.platform, forceRecheck = false } = {}) {
  if (cachedKind !== null && !forceRecheck) return cachedKind;
  const bwrapAvailable = platform === "linux" && commandExists("bwrap");
  const sandboxExecAvailable = platform === "darwin" && fs.existsSync(SANDBOX_EXEC_BIN);
  cachedKind = decideSandboxKind({ platform, bwrapAvailable, sandboxExecAvailable });
  return cachedKind;
}

/** Test-only: clears the process-lifetime cache so probeSandbox can be re-run under different fabricated conditions. */
export function _resetSandboxCache() {
  cachedKind = null;
}

/**
 * Builds a minimal SBPL profile: allow everything by default (matches the
 * "reads are unrestricted" decision above), then deny all writes except
 * under the given subpaths. `(subpath ...)` in SBPL already covers
 * descendants, so no separate recursive-globbing is needed.
 */
export function buildSandboxExecProfile(writablePaths) {
  const subpaths = writablePaths.map((p) => `(subpath "${p}")`).join(" ");
  return [
    "(version 1)",
    "(allow default)",
    "(deny file-write*)",
    `(allow file-write* ${subpaths})`,
  ].join("\n");
}

/**
 * Wraps a (cmd, args) pair so it runs confined to `writablePaths` for
 * writes, under whichever sandbox `kind` was detected. Returns the
 * original (cmd, args) unchanged for kind "none" — callers always get a
 * (cmd, args) pair back regardless of sandbox availability, so runBash.js
 * doesn't need an if/else at the spawn call site.
 */
export function wrapWithSandbox({ kind, cmd, args, cwd, writablePaths }) {
  if (kind === "bubblewrap") {
    const bwrapArgs = [
      "--ro-bind", "/", "/",
      "--dev", "/dev",
      "--proc", "/proc",
      "--tmpfs", "/tmp",
      "--die-with-parent",
      // Without a private PID namespace, sending SIGKILL to the bwrap
      // process only kills bwrap itself — SIGKILL can't be caught or
      // relayed, so the sandboxed child would be orphaned and keep
      // running past the timeout (verified empirically: a plain SIGKILL
      // to bwrap left `sleep` running). --unshare-pid makes bwrap the
      // namespace's process-1-equivalent monitor, which *does* forward
      // SIGTERM/SIGINT to the sandboxed process and tears down the whole
      // namespace when it exits — so runBash.js sends SIGTERM first (see
      // its timeout handler) specifically to take advantage of this.
      "--unshare-pid",
      "--chdir", cwd,
    ];
    for (const p of writablePaths) {
      bwrapArgs.push("--bind", p, p);
    }
    bwrapArgs.push("--", cmd, ...args);
    return { cmd: "bwrap", args: bwrapArgs };
  }

  if (kind === "sandbox-exec") {
    const profile = buildSandboxExecProfile(writablePaths);
    return { cmd: "sandbox-exec", args: ["-p", profile, cmd, ...args] };
  }

  return { cmd, args };
}

/**
 * Resolves the writable-path allowlist the same way pathGuard.js does for
 * write_file/edit_file (doc 09's allowedWritePaths, defaulting to project
 * root only) — one definition of "what's writable" shared by both the
 * per-file guard and the sandbox boundary, rather than two configs that
 * could silently drift apart.
 */
export function resolveWritablePaths({ cwd, allowedWritePaths = ["."] }) {
  return allowedWritePaths.map((p) => path.resolve(cwd, p));
}
