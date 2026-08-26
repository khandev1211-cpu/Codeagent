import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Uses the official SDK rather than hand-rolling JSON-RPC framing over
 * stdio — same reasoning `commander`/`ink`/`zod` are already dependencies
 * here: a real protocol with an official reference implementation is a
 * "use the library" case, unlike e.g. `src/safety/sandbox.js`'s bwrap/
 * sandbox-exec wrapping, which is direct OS process control with no
 * comparable standard library to defer to.
 *
 * Connecting to a server means spawning a subprocess per `serverConfig`
 * (stdio transport only, v1 scope — see discoverMcpServers.js). Each of
 * these three functions is a thin, single-purpose wrapper so the rest of
 * the MCP layer (wrapTool.js, index.js) can be tested against a fake
 * `client` object without a real subprocess or SDK involved at all.
 */

export async function connectMcpServer({ name, command, args, env }) {
  const transport = new StdioClientTransport({ command, args, env });
  const client = new Client({ name: "codeagent", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

export async function listMcpTools(client) {
  const result = await client.listTools();
  return result.tools;
}

export async function callMcpTool(client, name, input) {
  return client.callTool({ name, arguments: input });
}
