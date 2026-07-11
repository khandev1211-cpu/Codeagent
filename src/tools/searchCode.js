import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { loadGitignore } from "./gitignore.js";

function tryRipgrep(query, { cwd, filePattern }) {
  return new Promise((resolve) => {
    const args = ["--line-number", "--no-heading", "--max-count", "50"];
    if (filePattern) args.push("--glob", filePattern);
    args.push(query, ".");
    const proc = spawn("rg", args, { cwd });
    let stdout = "";
    let failed = false;
    proc.stdout.on("data", (d) => (stdout += d));
    proc.on("error", () => {
      failed = true;
      resolve(null); // rg not installed — signal fallback
    });
    proc.on("close", () => {
      if (!failed) resolve(stdout);
    });
  });
}

async function fallbackSearch(query, { cwd, filePattern, ignore }) {
  const results = [];
  const filePatternRegex = filePattern
    ? new RegExp(filePattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"))
    : null;

  async function walk(dir) {
    if (results.length >= 200) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(cwd, full);
      if (ignore(rel)) continue;
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        if (filePatternRegex && !filePatternRegex.test(entry.name)) continue;
        let content;
        try {
          content = await fs.readFile(full, "utf-8");
        } catch {
          continue; // binary or unreadable, skip
        }
        const lines = content.split("\n");
        lines.forEach((line, i) => {
          if (results.length >= 200) return;
          if (line.includes(query)) {
            results.push(`${rel}:${i + 1}:${line}`);
          }
        });
      }
      if (results.length >= 200) return;
    }
  }
  await walk(cwd);
  return results.join("\n");
}

export const searchCode = {
  name: "search_code",
  description: "Find where something is defined or used across the project via text/regex search.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text or regex to search for" },
      path: { type: "string", description: "Subdirectory to scope the search to" },
      file_pattern: { type: "string", description: "Glob to filter files, e.g. '*.js'" },
    },
    required: ["query"],
  },
  destructive: false,
  async execute(input, ctx) {
    const searchRoot = path.resolve(ctx.cwd, input.path || ".");
    const rgOutput = await tryRipgrep(input.query, {
      cwd: searchRoot,
      filePattern: input.file_pattern,
    });
    if (rgOutput !== null) {
      return { ok: true, matches: rgOutput.trim() || "(no matches)", engine: "ripgrep" };
    }
    const ignore = await loadGitignore(ctx.cwd);
    const matches = await fallbackSearch(input.query, {
      cwd: searchRoot,
      filePattern: input.file_pattern,
      ignore,
    });
    return { ok: true, matches: matches || "(no matches)", engine: "fallback" };
  },
};
