import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../skills/frontmatter.js";

const REQUIRED_FIELDS = ["name", "description"];

/**
 * Discovers slash-command prompt templates under `.codeagent/commands/
 * <name>.md` — same shape and same reasoning as discoverSubagents.js:
 * flat files (a command is a single self-contained template, no
 * supporting-files folder needed), project-scoped only for v1, a
 * malformed or incomplete definition is skipped with a warning rather
 * than thrown.
 */
export function discoverSlashCommands({ cwd = process.cwd(), logger } = {}) {
  const commandsDir = path.join(cwd, ".codeagent", "commands");
  if (!fs.existsSync(commandsDir)) return [];

  const entries = fs
    .readdirSync(commandsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"));
  const commands = [];

  for (const entry of entries) {
    const filePath = path.join(commandsDir, entry.name);

    let parsed;
    try {
      parsed = parseFrontmatter(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      logger?.warn(`Skipping command "${entry.name}": ${err.message}`);
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((field) => !parsed.frontmatter[field]);
    if (missing.length > 0) {
      logger?.warn(`Skipping command "${entry.name}": missing required field(s): ${missing.join(", ")}`);
      continue;
    }

    commands.push({
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      template: parsed.body,
      path: path.relative(cwd, filePath).split(path.sep).join("/"),
    });
  }

  return commands;
}
