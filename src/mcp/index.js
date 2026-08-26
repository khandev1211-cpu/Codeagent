import { discoverMcpServers } from "./discoverMcpServers.js";
import { connectMcpServer, listMcpTools, callMcpTool } from "./client.js";
import { wrapMcpTool } from "./wrapTool.js";

/**
 * Connects to every server in `.codeagent/mcp.json`, lists + wraps each
 * server's tools, and registers them into `toolRegistry` — mirrors
 * wireSkillsIndex/wireSubagentsIndex's shape (one function, called once
 * per session from each CLI entry point) even though MCP's setup is
 * async where those are synchronous (connecting means spawning a real
 * subprocess and completing an MCP handshake).
 *
 * A single server failing to connect or list tools does NOT fail the
 * whole session — same "one broken X doesn't take down the agent"
 * principle discoverSkills/discoverSubagents/discoverSlashCommands
 * already use, just at the connection level instead of the parse level.
 * Failures are collected and returned, not thrown, so a caller can
 * decide how loudly to report them (CLI listing vs. session startup).
 *
 * Returns `clients` (connected Client instances) specifically so
 * callers can close them at session end — MCP servers are subprocesses;
 * leaving them running past the session would leak processes.
 *
 * `connect`/`list`/`call` are injectable (defaulting to the real
 * client.js functions) purely for testability — tests exercise the
 * discovery/wiring/error-handling logic here against fake connections,
 * with client.js's real SDK usage covered separately and directly.
 */
export async function connectAllMcpServers({
  cwd,
  logger,
  toolRegistry,
  connect = connectMcpServer,
  list = listMcpTools,
  call = callMcpTool,
}) {
  const servers = discoverMcpServers({ cwd, logger });
  const clients = [];
  const errors = [];
  const tools = [];

  await Promise.all(
    servers.map(async (server) => {
      let client;
      try {
        client = await connect(server);
      } catch (err) {
        errors.push({ server: server.name, phase: "connect", error: err.message });
        logger?.warn(`MCP server "${server.name}" failed to connect: ${err.message}`);
        return;
      }
      clients.push(client);

      let mcpTools;
      try {
        mcpTools = await list(client);
      } catch (err) {
        errors.push({ server: server.name, phase: "list_tools", error: err.message });
        logger?.warn(`MCP server "${server.name}" connected but failed to list tools: ${err.message}`);
        return;
      }

      for (const mcpTool of mcpTools) {
        const wrapped = wrapMcpTool({
          serverName: server.name,
          mcpTool,
          callFn: (name, input) => call(client, name, input),
        });
        tools.push(wrapped);
        if (toolRegistry && !toolRegistry.has(wrapped.name)) toolRegistry.register(wrapped);
      }
    })
  );

  return { tools, clients, errors, serverCount: servers.length };
}

/** Closes every connected MCP client — call once at session end (process exit, REPL loop end, or TUI unmount) to avoid leaking server subprocesses. */
export async function closeAllMcpClients(clients) {
  await Promise.all(
    clients.map((client) =>
      client.close().catch(() => {
        // Best-effort cleanup — a server that's already exited or is
        // unresponsive to close() shouldn't prevent the process from
        // exiting.
      })
    )
  );
}
