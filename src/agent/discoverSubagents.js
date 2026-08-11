import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../skills/frontmatter.js";

const REQUIRED_FIELDS = ["name", "description"];

/**
 * Discovers subagent definitions under `.codeagent/agents/<name>.md` —
 * project-scoped only for v1, same reasoning as Skills (docs/19): the
 * multi-scope (personal / plugin-bundled) loading story belongs to the
 * Plugins phase, not bolted on early to something not yet proven.
 *
 * Flat files, not folder+SKILL.md like Skills — a subagent definition is
 * a single self-contained file (frontmatter + instructions body), so
 * there's no equivalent of a skill's supporting-files folder to justify
 * the extra directory level.
 *
 * A malformed or incomplete definition is skipped with a warning rather
 * than thrown — one broken subagent definition must not prevent every
 * other subagent (or the agent entirely) from starting, same principle
 * as discoverSkills.
 */
export function discoverSubagents({ cwd = process.cwd(), logger } = {}) {
  const agentsDir = path.join(cwd, ".codeagent", "agents");
  if (!fs.existsSync(agentsDir)) return [];

  const entries = fs
    .readdirSync(agentsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"));
  const subagents = [];

  for (const entry of entries) {
    const filePath = path.join(agentsDir, entry.name);

    let parsed;
    try {
      parsed = parseFrontmatter(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      logger?.warn(`Skipping subagent "${entry.name}": ${err.message}`);
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((field) => !parsed.frontmatter[field]);
    if (missing.length > 0) {
      logger?.warn(`Skipping subagent "${entry.name}": missing required field(s): ${missing.join(", ")}`);
      continue;
    }

    subagents.push({
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      // Comma-separated list narrowing which of the parent's tools this
      // subagent may use (intersected with the parent's actual set at
      // dispatch time — a definition can only narrow, never grant a tool
      // the parent doesn't have). null means "inherit everything the
      // parent has, minus run_subagent" (docs/22).
      tools: parsed.frontmatter.tools
        ? parsed.frontmatter.tools.split(",").map((t) => t.trim()).filter(Boolean)
        : null,
      instructions: parsed.body,
      path: path.relative(cwd, filePath).split(path.sep).join("/"),
    });
  }

  return subagents;
}
