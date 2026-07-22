import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadMcpConfig, discoverMcpTools } from "../../src/mcp/loader.js";
import { convertMcpToolToCodeagentTool } from "../../src/mcp/mcpClient.js";

describe("MCP Client & Loader", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-mcp-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty config if .codeagent/mcp.json does not exist", () => {
    const config = loadMcpConfig(tmpDir);
    expect(config).toEqual({});
  });

  it("loads mcpServers config from .codeagent/mcp.json", () => {
    const codeagentDir = path.join(tmpDir, ".codeagent");
    fs.mkdirSync(codeagentDir, { recursive: true });
    fs.writeFileSync(
      path.join(codeagentDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          testServer: {
            command: "node",
            args: ["server.js"],
          },
        },
      })
    );

    const config = loadMcpConfig(tmpDir);
    expect(config.testServer).toBeDefined();
    expect(config.testServer.command).toBe("node");
    expect(config.testServer.args).toEqual(["server.js"]);
  });

  it("converts MCP tool schema to codeagent tool format", async () => {
    const mockClient = {
      async callTool(name, args) {
        return { content: [{ type: "text", text: `Called ${name} with ${JSON.stringify(args)}` }] };
      },
    };

    const mcpTool = {
      name: "query_database",
      description: "Queries SQL database",
    };

    const codeagentTool = convertMcpToolToCodeagentTool("db", mcpTool, mockClient);

    expect(codeagentTool.name).toBe("db_query_database");
    expect(codeagentTool.description).toContain("[MCP: db]");
    expect(codeagentTool.destructive).toBe(true);

    const output = await codeagentTool.execute({ sql: "SELECT 1" });
    expect(output).toContain("Called query_database with {\"sql\":\"SELECT 1\"}");
  });
});
