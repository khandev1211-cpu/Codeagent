import { skillInfo } from "../tools/skillInfo.js";

export { SkillRegistry } from "./registry.js";
export { discoverSkills } from "./discover.js";
export { parseFrontmatter } from "./frontmatter.js";

/**
 * One place that decides, from config.skillsIndexMode, which tier of the
 * skills index a session gets and whether the skill_info tool needs to be
 * registered at all. All three CLI entry points (cli/index.js one-shot,
 * cli/repl.js, cli/tui/index.js) had near-identical skill-wiring code
 * before this — collapsed here so the two-tier decision lives in exactly
 * one place, same reasoning as tools/index.js's BUILTIN_TOOLS list.
 *
 * Registering skill_info only when there's something for it to do (compact
 * mode + at least one discovered skill) keeps "full" mode and no-skills
 * projects exactly as they were — no unused tool in the schema sent to
 * the provider on every turn.
 */
export function wireSkillsIndex({ skillRegistry, toolRegistry, config }) {
  const mode = config?.skillsIndexMode === "full" ? "full" : "compact";
  const hasSkills = skillRegistry.list().length > 0;

  if (mode === "compact" && hasSkills && toolRegistry && !toolRegistry.has("skill_info")) {
    toolRegistry.register(skillInfo);
  }

  return {
    skillsIndex: mode === "compact" ? skillRegistry.formatCompactIndexForPrompt() : skillRegistry.formatIndexForPrompt(),
    skillsIndexMode: mode,
  };
}
