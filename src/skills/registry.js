import { discoverSkills } from "./discover.js";

/**
 * Lightweight registry over discovered skills — mirrors the shape of
 * ToolRegistry (doc 05) and HookRegistry (doc 17) for consistency, though
 * Skills has no "run" step of its own: the model reads a skill's SKILL.md
 * via the existing read_file tool, exactly like any other project file.
 * No new tool was needed for this (PLAN.md Phase 4.1 explicitly asked
 * "check whether this needs a dedicated tool at all before building
 * one" — it doesn't: `.codeagent/skills/<name>/SKILL.md` are ordinary
 * project-relative paths, and read_file has no path restriction of its
 * own to work around).
 */
export class SkillRegistry {
  constructor({ cwd = process.cwd(), logger, skills } = {}) {
    this.cwd = cwd;
    this._skills = skills || discoverSkills({ cwd, logger });
  }

  list() {
    return this._skills;
  }

  has(name) {
    return this._skills.some((s) => s.name === name);
  }

  get(name) {
    return this._skills.find((s) => s.name === name) || null;
  }

  /**
   * A short index for the system prompt — name, description, and where to
   * read full instructions. Never the skill body itself; returns null
   * when there's nothing to show, so callers can skip the section
   * entirely rather than rendering an empty header (docs/19).
   */
  formatIndexForPrompt() {
    if (this._skills.length === 0) return null;
    return this._skills
      .map((s) => `- **${s.name}**: ${s.description} (read \`${s.path}\` for full instructions)`)
      .join("\n");
  }
}
