#!/usr/bin/env node
// A minimal, real MCP server used only by test/mcp/*.test.js — spawned as
// an actual subprocess over stdio, so the integration test exercises the
// real @modelcontextprotocol/sdk handshake, not a fake client object.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "codeagent-test-fixture", version: "1.0.0" });

server.registerTool(
  "echo",
  {
    description: "Echoes back the given message.",
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({ content: [{ type: "text", text: `Echo: ${message}` }] })
);

server.registerTool(
  "read_only_thing",
  {
    description: "A read-only tool, for testing the readOnlyHint annotation.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => ({ content: [{ type: "text", text: "read-only result" }] })
);

server.registerTool(
  "always_fails",
  {
    description: "Always returns an MCP-level error result.",
    inputSchema: {},
  },
  async () => ({ isError: true, content: [{ type: "text", text: "Simulated failure." }] })
);

const transport = new StdioServerTransport();
await server.connect(transport);
