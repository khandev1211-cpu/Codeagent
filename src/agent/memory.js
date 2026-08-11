import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Memory files are curated, user-authored instructions (not an
// auto-generated summary like context.js's README excerpt), so the cap is
// generous relative to README_CHAR_CAP (2000) — but still bounded, so one
// runaway file can't silently balloon every turn's system prompt cost.
const MEMORY_CHAR_CAP = 8000;

async function readCapped(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw.length > MEMORY_CHAR_CAP ? raw.slice(0, MEMORY_CHAR_CAP) + "\n[... truncated ...]" : raw;
  } catch {
    return null;
  }
}

/**
 * The CLAUDE.md-equivalent gap named in docs/16: a discoverable,
 * user-authored instruction file, auto-loaded every session — distinct
 * from `customSystemPromptAddendum`/`adminSystemPrompt` (docs/18), which
 * are single config-string values set via a CLI command, not a file the
 * team commits to the repo and edits directly.
 *
 * Two levels, v1 scope (docs/23 has the full reasoning for what's
 * deliberately NOT built): a global one at `~/.codeagent/AGENTS.md` for
 * cross-project personal preferences, and a project one at `AGENTS.md`
 * (repo root, not hidden under `.codeagent/` — same visibility reasoning
 * as README.md: a file the team is meant to see and edit directly, not
 * tool-internal config). No nested per-directory discovery, no `@import`
 * syntax — both real Claude Code capabilities, both skipped here as
 * speculative complexity for a need not yet demonstrated (same
 * "known but deferred" pattern as docs/19's original skills-index note).
 *
 * Missing files are not an error — most projects won't have either one,
 * same as most projects don't have a README either.
 */
export async function loadMemory({ cwd = process.cwd(), homedir = os.homedir() } = {}) {
  const [global, project] = await Promise.all([
    readCapped(path.join(homedir, ".codeagent", "AGENTS.md")),
    readCapped(path.join(cwd, "AGENTS.md")),
  ]);
  return { global, project };
}

/**
 * Renders both levels into one block for the system prompt, global first
 * (broad, cross-project) then project (more specific) — same "broad
 * context first, specific context after" ordering `systemPrompt.js`
 * already uses elsewhere (admin prompt before skills before project
 * context). Returns null when neither file exists, so callers can skip
 * the section entirely rather than rendering an empty header.
 */
export function formatMemoryForPrompt({ global, project }) {
  if (!global && !project) return null;
  const parts = [];
  if (global) parts.push(`### Personal preferences (~/.codeagent/AGENTS.md)\n${global}`);
  if (project) parts.push(`### Project instructions (AGENTS.md)\n${project}`);
  return parts.join("\n\n");
}
