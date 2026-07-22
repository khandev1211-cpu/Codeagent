import fs from "fs";
import path from "path";
import { McpStdioClient, convertMcpToolToCodeagentTool } from "./mcpClient.js";

/**
 * Loads MCP server configuration from .codeagent/mcp.json
 * 
 * @param {string} cwd 
 * @returns {Record<string, { command: string, args?: string[], env?: object }>}
 */
export function loadMcpConfig(cwd) {
  const mcpConfigPath = path.join(cwd, ".codeagent", "mcp.json");
  if (!fs.existsSync(mcpConfigPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(mcpConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed.mcpServers || parsed.servers || {};
  } catch (err) {
    return {};
  }
}

/**
 * Connects to configured MCP servers and converts their tools into codeagent tool objects.
 * 
 * @param {string} cwd 
 * @param {{ logger?: object }} options 
 * @returns {Promise<{ tools: object[], clients: McpStdioClient[] }>}
 */
export async function discoverMcpTools(cwd, { logger } = {}) {
  const servers = loadMcpConfig(cwd);
  const tools = [];
  const clients = [];

  for (const [serverName, config] of Object.entries(servers)) {
    if (!config.command) continue;

    try {
      const client = new McpStdioClient({
        command: config.command,
        args: config.args || [],
        env: config.env || {},
      });

      await client.connect();
      clients.push(client);

      const mcpTools = await client.listTools();
      for (const mcpTool of mcpTools) {
        const codeagentTool = convertMcpToolToCodeagentTool(serverName, mcpTool, client);
        tools.push(codeagentTool);
      }
    } catch (err) {
      logger?.error(`Failed to connect to MCP server '${serverName}': ${err.message}`);
    }
  }

  return { tools, clients };
}
