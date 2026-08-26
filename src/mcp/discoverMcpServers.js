import fs from "node:fs";
import path from "node:path";

/**
 * `.codeagent/mcp.json`, project-scoped only for v1 — modeled loosely on
 * Claude Code's `.mcp.json` (`mcpServers` object keyed by server name,
 * each with `command`/`args`/`env`). stdio transport only (PLAN.md's
 * stated v1 scope: "stdio first, simplest, matches how most local MCP
 * servers run"); HTTP/SSE transports are a later addition, not a gap
 * silently ignored.
 *
 * A `.codeagent/mcp.json` committed to a project is trusted at the same
 * level as `.codeagent/hooks.json` — both define commands that run
 * automatically at session start, same trust boundary as any other code
 * in the repo (docs/25 has the full reasoning). A malformed or
 * incomplete server entry is skipped with a warning, same defensive
 * pattern discoverSkills/discoverSubagents/discoverSlashCommands already
 * use — one broken entry must not prevent every other server (or the
 * session) from starting.
 */
export function discoverMcpServers({ cwd = process.cwd(), logger } = {}) {
  const configPath = path.join(cwd, ".codeagent", "mcp.json");
  if (!fs.existsSync(configPath)) return [];

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    logger?.warn(`Skipping .codeagent/mcp.json: invalid JSON (${err.message})`);
    return [];
  }

  const entries = raw?.mcpServers && typeof raw.mcpServers === "object" ? Object.entries(raw.mcpServers) : [];
  const servers = [];

  for (const [name, def] of entries) {
    if (!def || typeof def.command !== "string") {
      logger?.warn(`Skipping MCP server "${name}": missing required "command" field.`);
      continue;
    }
    servers.push({
      name,
      command: def.command,
      args: Array.isArray(def.args) ? def.args : [],
      env: def.env && typeof def.env === "object" ? def.env : undefined,
    });
  }

  return servers;
}
