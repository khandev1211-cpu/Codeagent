import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverMcpServers } from "../../src/mcp/discoverMcpServers.js";

function writeConfig(cwd, obj) {
  const dir = path.join(cwd, ".codeagent");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify(obj));
}

describe("discoverMcpServers", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-mcp-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty array when .codeagent/mcp.json doesn't exist", () => {
    expect(discoverMcpServers({ cwd: tmpDir })).toEqual([]);
  });

  it("discovers a well-formed server definition", () => {
    writeConfig(tmpDir, { mcpServers: { github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] } } });
    const result = discoverMcpServers({ cwd: tmpDir });
    expect(result).toEqual([{ name: "github", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"], env: undefined }]);
  });

  it("discovers multiple servers", () => {
    writeConfig(tmpDir, { mcpServers: { a: { command: "cmd-a" }, b: { command: "cmd-b" } } });
    const result = discoverMcpServers({ cwd: tmpDir });
    expect(result.map((s) => s.name)).toEqual(["a", "b"]);
  });

  it("defaults args to an empty array when omitted", () => {
    writeConfig(tmpDir, { mcpServers: { simple: { command: "some-server" } } });
    expect(discoverMcpServers({ cwd: tmpDir })[0].args).toEqual([]);
  });

  it("passes through env when provided", () => {
    writeConfig(tmpDir, { mcpServers: { api: { command: "cmd", env: { API_KEY: "secret" } } } });
    expect(discoverMcpServers({ cwd: tmpDir })[0].env).toEqual({ API_KEY: "secret" });
  });

  it("skips a server entry missing the required command field, with a warning", () => {
    writeConfig(tmpDir, { mcpServers: { broken: { args: ["x"] } } });
    const warnings = [];
    const result = discoverMcpServers({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(result).toEqual([]);
    expect(warnings.length).toBe(1);
  });

  it("skips invalid JSON with a warning rather than throwing", () => {
    const dir = path.join(tmpDir, ".codeagent");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "mcp.json"), "{ not valid json");
    const warnings = [];
    const result = discoverMcpServers({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(result).toEqual([]);
    expect(warnings.length).toBe(1);
  });

  it("returns an empty array when mcpServers key is missing entirely", () => {
    writeConfig(tmpDir, {});
    expect(discoverMcpServers({ cwd: tmpDir })).toEqual([]);
  });
});
