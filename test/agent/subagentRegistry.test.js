import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverSubagents } from "../../src/agent/discoverSubagents.js";
import { SubagentRegistry, wireSubagentsIndex } from "../../src/agent/subagentRegistry.js";
import { ToolRegistry } from "../../src/tools/registry.js";

function writeAgent(dir, filename, content) {
  fs.writeFileSync(path.join(dir, filename), content);
}

describe("discoverSubagents", () => {
  let tmpDir;
  let agentsDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-agents-"));
    agentsDir = path.join(tmpDir, ".codeagent", "agents");
    fs.mkdirSync(agentsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty array when .codeagent/agents doesn't exist", () => {
    fs.rmSync(agentsDir, { recursive: true, force: true });
    expect(discoverSubagents({ cwd: tmpDir })).toEqual([]);
  });

  it("discovers a well-formed subagent definition", () => {
    writeAgent(agentsDir, "reviewer.md", "---\nname: reviewer\ndescription: Reviews a diff for issues.\n---\nYou are a strict code reviewer.");
    const result = discoverSubagents({ cwd: tmpDir });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "reviewer",
      description: "Reviews a diff for issues.",
      tools: null,
      instructions: "You are a strict code reviewer.",
    });
  });

  it("parses a comma-separated tools field into an array", () => {
    writeAgent(agentsDir, "readonly.md", "---\nname: readonly\ndescription: Read-only investigator.\ntools: read_file, search_code, list_dir\n---\nOnly investigate, never write.");
    const result = discoverSubagents({ cwd: tmpDir });
    expect(result[0].tools).toEqual(["read_file", "search_code", "list_dir"]);
  });

  it("skips a definition missing required fields, with a warning, without throwing", () => {
    writeAgent(agentsDir, "broken.md", "---\nname: broken\n---\nNo description field.");
    const warnings = [];
    const result = discoverSubagents({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(result).toEqual([]);
    expect(warnings.length).toBe(1);
  });

  it("skips a malformed file (no frontmatter) with a warning, without crashing the whole discovery pass", () => {
    writeAgent(agentsDir, "malformed.md", "Just plain text, no frontmatter block.");
    writeAgent(agentsDir, "ok.md", "---\nname: ok\ndescription: fine\n---\nBody.");
    const warnings = [];
    const result = discoverSubagents({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(result.map((r) => r.name)).toEqual(["ok"]);
    expect(warnings.length).toBe(1);
  });

  it("ignores non-.md files in the agents directory", () => {
    writeAgent(agentsDir, "notes.txt", "irrelevant");
    expect(discoverSubagents({ cwd: tmpDir })).toEqual([]);
  });
});

describe("SubagentRegistry", () => {
  const SAMPLE = [
    { name: "reviewer", description: "Reviews a diff.", tools: null, instructions: "Review it.", path: ".codeagent/agents/reviewer.md" },
    { name: "tester", description: "Writes tests.", tools: ["read_file", "write_file"], instructions: "Write tests.", path: ".codeagent/agents/tester.md" },
  ];

  it("list/has/get behave as expected", () => {
    const registry = new SubagentRegistry({ subagents: SAMPLE });
    expect(registry.list()).toEqual(SAMPLE);
    expect(registry.has("reviewer")).toBe(true);
    expect(registry.has("nonexistent")).toBe(false);
    expect(registry.get("tester")).toEqual(SAMPLE[1]);
    expect(registry.get("nonexistent")).toBeNull();
  });

  it("formatIndexForPrompt returns null when there are no subagents", () => {
    expect(new SubagentRegistry({ subagents: [] }).formatIndexForPrompt()).toBeNull();
  });

  it("formatIndexForPrompt includes name and description for each subagent", () => {
    const index = new SubagentRegistry({ subagents: SAMPLE }).formatIndexForPrompt();
    expect(index).toContain("reviewer");
    expect(index).toContain("Reviews a diff.");
    expect(index).toContain("tester");
    expect(index).toContain("Writes tests.");
  });
});

describe("wireSubagentsIndex", () => {
  it("registers run_subagent when at least one subagent exists", () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "a", description: "d", tools: null, instructions: "i", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });
    expect(toolRegistry.has("run_subagent")).toBe(true);
  });

  it("does not register run_subagent when there are no subagents", () => {
    const subagentRegistry = new SubagentRegistry({ subagents: [] });
    const toolRegistry = new ToolRegistry([]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });
    expect(toolRegistry.has("run_subagent")).toBe(false);
  });

  it("is idempotent — calling it twice does not double-register", () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "a", description: "d", tools: null, instructions: "i", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });
    expect(() => wireSubagentsIndex({ subagentRegistry, toolRegistry })).not.toThrow();
    expect(toolRegistry.list().filter((t) => t.name === "run_subagent")).toHaveLength(1);
  });
});
