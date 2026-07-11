import fs from "node:fs/promises";
import path from "node:path";

const ALWAYS_IGNORE = [".git", "node_modules"];

/**
 * Minimal .gitignore support: exact names, simple globs, and directory
 * markers. Not a full gitignore parser — good enough to keep noisy
 * directories out of tool output by default (doc 05).
 */
export async function loadGitignore(cwd) {
  let patterns = [...ALWAYS_IGNORE];
  try {
    const raw = await fs.readFile(path.join(cwd, ".gitignore"), "utf-8");
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    patterns = patterns.concat(lines.map((l) => l.replace(/\/$/, "")));
  } catch {
    // no .gitignore present — that's fine, defaults still apply
  }

  return function isIgnored(relPath) {
    const segments = relPath.split(path.sep);
    return patterns.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(
          "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
        );
        return segments.some((seg) => regex.test(seg));
      }
      return segments.includes(pattern);
    });
  };
}
