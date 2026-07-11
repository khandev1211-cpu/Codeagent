import fs from "node:fs/promises";
import path from "node:path";
import { loadGitignore } from "../tools/gitignore.js";

const PINNED_RECENT_TURNS = 6;
const README_CHAR_CAP = 2000;

/** Bounded directory tree, respecting .gitignore, capped in depth/breadth (doc 08). */
async function buildProjectTree(cwd, { maxDepth = 3, maxEntriesPerDir = 30 } = {}) {
  const ignore = await loadGitignore(cwd);

  async function walk(dir, depth) {
    if (depth > maxDepth) return "";
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return "";
    }
    entries = entries
      .filter((e) => !ignore(path.relative(cwd, path.join(dir, e.name))))
      .slice(0, maxEntriesPerDir);

    let out = "";
    for (const entry of entries) {
      const indent = "  ".repeat(depth);
      out += `${indent}${entry.name}${entry.isDirectory() ? "/" : ""}\n`;
      if (entry.isDirectory()) {
        out += await walk(path.join(dir, entry.name), depth + 1);
      }
    }
    return out;
  }

  return walk(cwd, 0);
}

async function readManifest(cwd) {
  try {
    return await fs.readFile(path.join(cwd, "package.json"), "utf-8");
  } catch {
    return null;
  }
}

async function readReadmeSummary(cwd) {
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    try {
      const raw = await fs.readFile(path.join(cwd, name), "utf-8");
      return raw.length > README_CHAR_CAP ? raw.slice(0, README_CHAR_CAP) + "\n[... truncated ...]" : raw;
    } catch {
      // try next candidate name
    }
  }
  return null;
}

/**
 * Builds a bounded project-context summary once per session, injected into
 * the system prompt rather than re-sent on every turn (doc 08).
 */
export async function buildProjectContext(cwd) {
  const [tree, manifest, readme] = await Promise.all([
    buildProjectTree(cwd),
    readManifest(cwd),
    readReadmeSummary(cwd),
  ]);
  return { tree, manifest, readme };
}

/**
 * Context Manager for conversation history growth. Pins recent turns
 * verbatim, summarizes older ones via a (cheap) provider call, and keeps
 * recently-touched files pinned regardless of turn age (doc 08).
 */
export class ContextManager {
  constructor({ provider, tokenBudget = 150_000 } = {}) {
    this.provider = provider;
    this.tokenBudget = tokenBudget;
    this.pinnedPaths = new Set();
  }

  touchFile(relPath) {
    this.pinnedPaths.add(relPath);
  }

  async maybeCompact(messages) {
    const estimated = this.provider.countTokens(messages);
    if (estimated < this.tokenBudget * 0.8) {
      return messages; // below the approaching-limit threshold, nothing to do
    }

    const recent = messages.slice(-PINNED_RECENT_TURNS);
    const older = messages.slice(0, -PINNED_RECENT_TURNS);
    if (older.length === 0) return messages;

    const summaryText = await this._summarize(older);
    const summaryMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: `[Summary of earlier conversation, condensed for space]\n${summaryText}`,
        },
      ],
    };
    return [summaryMessage, ...recent];
  }

  async _summarize(olderMessages) {
    const plainText = olderMessages
      .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      .join("\n")
      .slice(0, 20_000);

    const result = await this.provider.send(
      [
        {
          role: "user",
          content: `Summarize the key actions and decisions from this earlier part of a coding session in a short paragraph, omitting full file contents:\n\n${plainText}`,
        },
      ],
      [],
      { maxTokens: 500 }
    );
    const textBlock = result.content.find((b) => b.type === "text");
    return textBlock?.text || "(summary unavailable)";
  }
}
