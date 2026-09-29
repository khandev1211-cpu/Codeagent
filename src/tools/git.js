import { execFile } from "node:child_process";
import path from "node:path";

const GIT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 100_000;

// Refs may contain letters, digits and these punctuation marks only. A leading
// "-" is rejected separately: it would let a "ref" smuggle in an option such as
// --output=<file>, which makes `git diff` write to disk.
const SAFE_REF = /^[A-Za-z0-9._/~^@{}:,+-]+$/;

/**
 * Runs git without a shell (execFile), so nothing in `args` is ever
 * interpreted by a shell. Config-driven program execution that a hostile
 * repository could set up (fsmonitor) is switched off with -c overrides.
 */
export function runGit(args, { cwd, timeoutMs = GIT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-c", "core.fsmonitor=false", "--no-pager", ...args],
      { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES * 10, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT") return resolve({ ok: false, error: "git is not installed or not on PATH" });
          if (err.killed) return resolve({ ok: false, error: `git timed out after ${timeoutMs}ms` });
          const message = (stderr || err.message || "git failed").trim();
          if (/not a git repository/i.test(message)) {
            return resolve({ ok: false, error: "Not a git repository" });
          }
          return resolve({ ok: false, error: message });
        }
        resolve({ ok: true, stdout });
      }
    );
  });
}

function truncate(text) {
  if (Buffer.byteLength(text) <= MAX_OUTPUT_BYTES) return { text, truncated: false };
  return { text: Buffer.from(text).subarray(0, MAX_OUTPUT_BYTES).toString("utf-8"), truncated: true };
}

export const gitStatus = {
  name: "git_status",
  description:
    "Show the current branch and which files are modified, staged or untracked (read-only, machine-readable).",
  input_schema: { type: "object", properties: {}, required: [] },
  destructive: false,
  async execute(_input, ctx) {
    const res = await runGit(["--no-optional-locks", "status", "--porcelain=v1", "--branch"], { cwd: ctx.cwd });
    if (!res.ok) return res;
    const lines = res.stdout.split("\n").filter(Boolean);
    const branchLine = lines.find((l) => l.startsWith("##"));
    const files = lines.filter((l) => !l.startsWith("##"));
    const { text, truncated } = truncate(files.join("\n"));
    return {
      ok: true,
      branch: branchLine ? branchLine.slice(3) : null,
      clean: files.length === 0,
      // XY <path>: X = staged state, Y = working-tree state, "??" = untracked.
      files: text || "(clean)",
      ...(truncated ? { truncated: true } : {}),
    };
  },
};

export const gitDiff = {
  name: "git_diff",
  description:
    "Show a git diff (read-only). By default the unstaged working-tree changes; set staged for the index, or ref to diff against a commit/branch (e.g. HEAD~1).",
  input_schema: {
    type: "object",
    properties: {
      staged: { type: "boolean", description: "Diff staged changes instead of unstaged", default: false },
      ref: { type: "string", description: "Commit, branch or range to diff against, e.g. HEAD~1 or main...HEAD" },
      path: { type: "string", description: "Limit the diff to this file or directory, relative to project root" },
    },
    required: [],
  },
  destructive: false,
  async execute(input, ctx) {
    const args = ["diff", "--no-ext-diff", "--no-textconv", "--no-color"];
    if (input.staged) args.push("--cached");

    if (input.ref !== undefined) {
      if (typeof input.ref !== "string" || input.ref.startsWith("-") || !SAFE_REF.test(input.ref)) {
        return { ok: false, error: `Invalid ref: ${JSON.stringify(input.ref)}` };
      }
      args.push(input.ref);
    }

    // "--" ends option parsing, so a path can never be read as a flag.
    args.push("--");
    if (input.path) {
      const resolved = path.resolve(ctx.cwd, input.path);
      const rel = path.relative(ctx.cwd, resolved);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return { ok: false, error: `Path is outside the project: ${input.path}` };
      }
      args.push(rel || ".");
    }

    const res = await runGit(args, { cwd: ctx.cwd });
    if (!res.ok) return res;
    if (!res.stdout.trim()) return { ok: true, diff: "(no changes)" };
    const { text, truncated } = truncate(res.stdout);
    return { ok: true, diff: text, ...(truncated ? { truncated: true } : {}) };
  },
};
