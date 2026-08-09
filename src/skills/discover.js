import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

const REQUIRED_FIELDS = ["name", "description"];

/**
 * Discovers skills under `.codeagent/skills/<name>/SKILL.md` — project-
 * scoped only for v1. Personal (`~/.codeagent/skills`) and plugin-bundled
 * skills are deferred to the Plugins phase (docs/16, PLAN.md Phase 8),
 * same reasoning as hooks.json (docs/17): the multi-scope loading story
 * belongs there, not bolted on early to something not yet proven.
 *
 * A skill folder with no SKILL.md, or with malformed/incomplete
 * frontmatter, is skipped with a warning rather than thrown — one broken
 * skill must not prevent every other skill (or the agent entirely) from
 * starting.
 *
 * Returns only lightweight index entries — name, description, allowed-
 * tools, and the file's path — **never the skill body**. That's the whole
 * point of progressive disclosure (docs/19): this index is what goes in
 * the system prompt; the model reads a specific SKILL.md on demand, via
 * the existing read_file tool, only if it decides that skill is relevant.
 */
export function discoverSkills({ cwd = process.cwd(), logger } = {}) {
  const skillsDir = path.join(cwd, ".codeagent", "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  const skills = [];

  for (const entry of entries) {
    const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      logger?.warn(`Skipping skill "${entry.name}": no SKILL.md found`);
      continue;
    }

    let parsed;
    try {
      parsed = parseFrontmatter(fs.readFileSync(skillMdPath, "utf-8"));
    } catch (err) {
      logger?.warn(`Skipping skill "${entry.name}": ${err.message}`);
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((field) => !parsed.frontmatter[field]);
    if (missing.length > 0) {
      logger?.warn(`Skipping skill "${entry.name}": missing required field(s): ${missing.join(", ")}`);
      continue;
    }

    skills.push({
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      // Parsed and carried through now so it's available the moment
      // Phase 5 (permission rules) gives it a real enforcement point —
      // inert until then, deliberately (PLAN.md Phase 4.1).
      allowedTools: parsed.frontmatter["allowed-tools"]
        ? parsed.frontmatter["allowed-tools"].split(",").map((t) => t.trim()).filter(Boolean)
        : null,
      path: path.relative(cwd, skillMdPath).split(path.sep).join("/"),
    });
  }

  return skills;
}
