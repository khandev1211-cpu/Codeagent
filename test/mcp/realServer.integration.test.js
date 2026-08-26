import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectMcpServer, listMcpTools, callMcpTool } from "../../src/mcp/client.js";
import { wrapMcpTool } from "../../src/mcp/wrapTool.js";
import { connectAllMcpServers, closeAllMcpClients } from "../../src/mcp/index.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import fs from "node:fs";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_SERVER = path.join(__dirname, "fixtures", "testServer.mjs");

// These exercise the real, installed @modelcontextprotocol/sdk against a
// real spawned subprocess (test/mcp/fixtures/testServer.mjs) — not
// mocked. wrapTool.test.js and index.test.js already cover the wrapping/
// orchestration logic against fake connections; this file is specifically
// here to prove the actual stdio handshake, tool listing, and tool
// calling work against the real protocol implementation.
describe("MCP client (real subprocess, real SDK)", () => {
  let client;

  afterEach(async () => {
    if (client) {
      await client.close().catch(() => {});
      client = undefined;
    }
  });

  it("connects to a real server over stdio and lists its actual tools", async () => {
    client = await connectMcpServer({ command: "node", args: [FIXTURE_SERVER] });
    const tools = await listMcpTools(client);
    expect(tools.map((t) => t.name).sort()).toEqual(["always_fails", "echo", "read_only_thing"]);
  });

  it("calls a real tool and gets back its actual result", async () => {
    client = await connectMcpServer({ command: "node", args: [FIXTURE_SERVER] });
    const result = await callMcpTool(client, "echo", { message: "hello" });
    expect(result.content[0].text).toBe("Echo: hello");
  });

  it("a real tool's isError:true result comes through correctly", async () => {
    client = await connectMcpServer({ command: "node", args: [FIXTURE_SERVER] });
    const result = await callMcpTool(client, "always_fails", {});
    expect(result.isError).toBe(true);
  });

  it("end-to-end: wrapMcpTool + a real tool call produces the exact Tool-shaped result", async () => {
    client = await connectMcpServer({ command: "node", args: [FIXTURE_SERVER] });
    const tools = await listMcpTools(client);
    const echoDef = tools.find((t) => t.name === "echo");
    const wrapped = wrapMcpTool({
      serverName: "fixture",
      mcpTool: echoDef,
      callFn: (name, input) => callMcpTool(client, name, input),
    });
    const result = await wrapped.execute({ message: "world" });
    expect(result).toEqual({ ok: true, content: "Echo: world" });
  });

  it("the real server's readOnlyHint annotation correctly makes the wrapped tool non-destructive", async () => {
    client = await connectMcpServer({ command: "node", args: [FIXTURE_SERVER] });
    const tools = await listMcpTools(client);
    const readOnlyDef = tools.find((t) => t.name === "read_only_thing");
    const wrapped = wrapMcpTool({ serverName: "fixture", mcpTool: readOnlyDef, callFn: () => {} });
    expect(wrapped.destructive).toBe(false);

    const echoDef = tools.find((t) => t.name === "echo");
    const wrappedEcho = wrapMcpTool({ serverName: "fixture", mcpTool: echoDef, callFn: () => {} });
    expect(wrappedEcho.destructive).toBe(true);
  });
});

describe("connectAllMcpServers (real subprocess, real SDK, via .codeagent/mcp.json)", () => {
  let tmpDir;
  let clients = [];

  afterEach(async () => {
    await closeAllMcpClients(clients);
    clients = [];
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers a real server from mcp.json, connects, and registers its real tools into the ToolRegistry", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-mcp-e2e-"));
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "mcp.json"),
      JSON.stringify({ mcpServers: { fixture: { command: "node", args: [FIXTURE_SERVER] } } })
    );

    const toolRegistry = new ToolRegistry([]);
    const result = await connectAllMcpServers({ cwd: tmpDir, toolRegistry });
    clients = result.clients;

    expect(result.errors).toEqual([]);
    expect(toolRegistry.has("mcp__fixture__echo")).toBe(true);
    expect(toolRegistry.has("mcp__fixture__read_only_thing")).toBe(true);

    const echoTool = toolRegistry.get("mcp__fixture__echo");
    const callResult = await echoTool.execute({ message: "integration test" });
    expect(callResult).toEqual({ ok: true, content: "Echo: integration test" });
  });

  it("a real server that fails to spawn is a non-fatal error, not a thrown exception", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-mcp-e2e-fail-"));
    fs.mkdirSync(path.join(tmpDir, ".codeagent"));
    fs.writeFileSync(
      path.join(tmpDir, ".codeagent", "mcp.json"),
      JSON.stringify({ mcpServers: { nonexistent: { command: "this-command-does-not-exist-anywhere" } } })
    );

    const toolRegistry = new ToolRegistry([]);
    const result = await connectAllMcpServers({ cwd: tmpDir, toolRegistry });
    clients = result.clients;

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].server).toBe("nonexistent");
    expect(toolRegistry.list()).toEqual([]);
  });
}, 15000);
