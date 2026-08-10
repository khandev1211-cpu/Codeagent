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

  /**
   * Tier 1 of the two-tier index (docs/19's flagged-but-deferred cost
   * fix, now built): names only, no descriptions, no paths. At scale
   * this is the difference between ~6,500 tokens/turn and a few hundred
   * — the model gets enough to recognize an obviously-relevant name
   * (e.g. "commit-message" for a commit task) and calls skill_info for
   * anything it needs to check further. Same null-when-empty contract
   * as formatIndexForPrompt so callers can skip the section entirely.
   */
  formatCompactIndexForPrompt() {
    if (this._skills.length === 0) return null;
    return this._skills.map((s) => s.name).join(", ");
  }

  /**
   * Tier 2 lookup: full description + path for one or more names, fetched
   * on demand (via the skill_info tool) rather than paid on every turn.
   * Unknown names are reported back rather than silently dropped, so the
   * model can tell "no such skill" apart from "this skill has no
   * description" — it should never have either, but the tool boundary is
   * the right place to be defensive about it.
   */
  describe(names) {
    return names.map((name) => {
      const skill = this.get(name);
      if (!skill) return { name, found: false };
      return { name, found: true, description: skill.description, path: skill.path };
    });
  }
}
