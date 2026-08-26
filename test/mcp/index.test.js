import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connectAllMcpServers, closeAllMcpClients } from "../../src/mcp/index.js";
import { ToolRegistry } from "../../src/tools/registry.js";

function writeConfig(cwd, obj) {
  const dir = path.join(cwd, ".codeagent");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify(obj));
}

describe("connectAllMcpServers", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-mcp-index-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty tools/clients/errors when there's no mcp.json at all", async () => {
    const result = await connectAllMcpServers({ cwd: tmpDir, toolRegistry: new ToolRegistry([]) });
    expect(result).toEqual({ tools: [], clients: [], errors: [], serverCount: 0 });
  });

  it("connects to each configured server, wraps tools, and registers them into toolRegistry", async () => {
    writeConfig(tmpDir, { mcpServers: { fake: { command: "fake-cmd" } } });
    const toolRegistry = new ToolRegistry([]);
    const fakeClient = { name: "fake-client" };
    const connect = async () => fakeClient;
    const list = async () => [{ name: "do_thing", description: "Does a thing.", inputSchema: { type: "object", properties: {} } }];
    const call = async () => ({ content: [{ type: "text", text: "done" }] });

    const result = await connectAllMcpServers({ cwd: tmpDir, toolRegistry, connect, list, call });

    expect(result.serverCount).toBe(1);
    expect(result.clients).toEqual([fakeClient]);
    expect(result.errors).toEqual([]);
    expect(result.tools).toHaveLength(1);
    expect(toolRegistry.has("mcp__fake__do_thing")).toBe(true);
  });

  it("a server that fails to connect does not prevent other servers from connecting (non-fatal, collected in errors)", async () => {
    writeConfig(tmpDir, { mcpServers: { broken: { command: "bad-cmd" }, working: { command: "good-cmd" } } });
    const toolRegistry = new ToolRegistry([]);
    const connect = async (server) => {
      if (server.name === "broken") throw new Error("spawn ENOENT");
      return { name: "working-client" };
    };
    const list = async () => [{ name: "tool_a", description: "d", inputSchema: { type: "object", properties: {} } }];
    const call = async () => ({ content: [] });

    const result = await connectAllMcpServers({ cwd: tmpDir, toolRegistry, connect, list, call });

    expect(result.errors).toEqual([{ server: "broken", phase: "connect", error: "spawn ENOENT" }]);
    expect(result.clients).toHaveLength(1);
    expect(toolRegistry.has("mcp__working__tool_a")).toBe(true);
  });

  it("a server that connects but fails to list tools is still collected as a non-fatal error", async () => {
    writeConfig(tmpDir, { mcpServers: { flaky: { command: "cmd" } } });
    const toolRegistry = new ToolRegistry([]);
    const connect = async () => ({ name: "client" });
    const list = async () => {
      throw new Error("timeout listing tools");
    };
    const call = async () => ({ content: [] });

    const result = await connectAllMcpServers({ cwd: tmpDir, toolRegistry, connect, list, call });

    expect(result.errors).toEqual([{ server: "flaky", phase: "list_tools", error: "timeout listing tools" }]);
    // The client is still connected (and should still be closed at session end) even though listing failed.
    expect(result.clients).toHaveLength(1);
  });

  it("logs a warning (not silent) for both connect and list_tools failures", async () => {
    writeConfig(tmpDir, { mcpServers: { broken: { command: "cmd" } } });
    const warnings = [];
    await connectAllMcpServers({
      cwd: tmpDir,
      logger: { warn: (m) => warnings.push(m) },
      toolRegistry: new ToolRegistry([]),
      connect: async () => {
        throw new Error("nope");
      },
    });
    expect(warnings.length).toBe(1);
  });

  it("registers tools from multiple servers without name collisions, even with identically-named tools", async () => {
    writeConfig(tmpDir, { mcpServers: { serverA: { command: "a" }, serverB: { command: "b" } } });
    const toolRegistry = new ToolRegistry([]);
    const connect = async (server) => ({ name: server.name });
    const list = async () => [{ name: "search", description: "d", inputSchema: { type: "object", properties: {} } }];
    const call = async () => ({ content: [] });

    await connectAllMcpServers({ cwd: tmpDir, toolRegistry, connect, list, call });

    expect(toolRegistry.has("mcp__serverA__search")).toBe(true);
    expect(toolRegistry.has("mcp__serverB__search")).toBe(true);
  });
});

describe("closeAllMcpClients", () => {
  it("calls close() on every client", async () => {
    const closed = [];
    const clients = [
      { close: async () => closed.push("a") },
      { close: async () => closed.push("b") },
    ];
    await closeAllMcpClients(clients);
    expect(closed.sort()).toEqual(["a", "b"]);
  });

  it("a client whose close() rejects doesn't prevent the others from closing", async () => {
    const closed = [];
    const clients = [
      { close: async () => { throw new Error("already exited"); } },
      { close: async () => closed.push("b") },
    ];
    await expect(closeAllMcpClients(clients)).resolves.toBeUndefined();
    expect(closed).toEqual(["b"]);
  });

  it("handles an empty client list without error", async () => {
    await expect(closeAllMcpClients([])).resolves.toBeUndefined();
  });
});
