import { discoverSubagents } from "./discoverSubagents.js";
import { runSubagent } from "../tools/runSubagent.js";

/**
 * Mirrors SkillRegistry's shape (docs/19) — same constructor pattern
 * (accepts pre-built `subagents` for tests, discovers from disk
 * otherwise), same list/has/get surface. See docs/22 for the full design.
 */
export class SubagentRegistry {
  constructor({ cwd = process.cwd(), logger, subagents } = {}) {
    this.cwd = cwd;
    this._subagents = subagents || discoverSubagents({ cwd, logger });
  }

  list() {
    return this._subagents;
  }

  has(name) {
    return this._subagents.some((s) => s.name === name);
  }

  get(name) {
    return this._subagents.find((s) => s.name === name) || null;
  }

  /**
   * Full name + description index for the system prompt. Deliberately
   * not the two-tier compact treatment Skills needed (docs/19) — see
   * docs/22's "System prompt footprint" section for why: subagent counts
   * are expected to be small, so building that now would be solving a
   * cost problem that doesn't exist yet.
   */
  formatIndexForPrompt() {
    if (this._subagents.length === 0) return null;
    return this._subagents.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
  }
}

/**
 * Mirrors wireSkillsIndex (src/skills/index.js): the one place that
 * decides whether run_subagent needs registering at all. Registering it
 * only when there's at least one discovered subagent keeps a project with
 * no `.codeagent/agents/` exactly as it was before this feature existed —
 * no unused tool in the schema sent to the provider on every turn.
 */
export function wireSubagentsIndex({ subagentRegistry, toolRegistry }) {
  const hasSubagents = subagentRegistry.list().length > 0;
  if (hasSubagents && toolRegistry && !toolRegistry.has("run_subagent")) {
    toolRegistry.register(runSubagent);
  }
  return { subagentsIndex: subagentRegistry.formatIndexForPrompt() };
}
