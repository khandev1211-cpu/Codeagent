import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadMemory, formatMemoryForPrompt } from "../../src/agent/memory.js";

describe("loadMemory", () => {
  let cwd;
  let homedir;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-project-"));
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-home-"));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(homedir, { recursive: true, force: true });
  });

  it("returns { global: null, project: null } when neither file exists", async () => {
    const result = await loadMemory({ cwd, homedir });
    expect(result).toEqual({ global: null, project: null });
  });

  it("loads a project-level AGENTS.md at the repo root", async () => {
    fs.writeFileSync(path.join(cwd, "AGENTS.md"), "Use tabs, not spaces.");
    const result = await loadMemory({ cwd, homedir });
    expect(result.project).toBe("Use tabs, not spaces.");
    expect(result.global).toBeNull();
  });

  it("loads a global AGENTS.md at ~/.codeagent/AGENTS.md", async () => {
    fs.mkdirSync(path.join(homedir, ".codeagent"), { recursive: true });
    fs.writeFileSync(path.join(homedir, ".codeagent", "AGENTS.md"), "I prefer concise commit messages.");
    const result = await loadMemory({ cwd, homedir });
    expect(result.global).toBe("I prefer concise commit messages.");
    expect(result.project).toBeNull();
  });

  it("loads both levels independently when both exist", async () => {
    fs.mkdirSync(path.join(homedir, ".codeagent"), { recursive: true });
    fs.writeFileSync(path.join(homedir, ".codeagent", "AGENTS.md"), "global instructions");
    fs.writeFileSync(path.join(cwd, "AGENTS.md"), "project instructions");
    const result = await loadMemory({ cwd, homedir });
    expect(result.global).toBe("global instructions");
    expect(result.project).toBe("project instructions");
  });

  it("truncates a file larger than the character cap rather than loading it whole", async () => {
    fs.writeFileSync(path.join(cwd, "AGENTS.md"), "x".repeat(10_000));
    const result = await loadMemory({ cwd, homedir });
    expect(result.project.length).toBeLessThan(10_000);
    expect(result.project).toContain("truncated");
  });
});

describe("formatMemoryForPrompt", () => {
  it("returns null when neither level has content", () => {
    expect(formatMemoryForPrompt({ global: null, project: null })).toBeNull();
  });

  it("includes only the project section when global is absent", () => {
    const result = formatMemoryForPrompt({ global: null, project: "project rules" });
    expect(result).toContain("project rules");
    expect(result).not.toContain("Personal preferences");
  });

  it("includes only the global section when project is absent", () => {
    const result = formatMemoryForPrompt({ global: "global rules", project: null });
    expect(result).toContain("global rules");
    expect(result).not.toContain("Project instructions");
  });

  it("orders global before project when both are present", () => {
    const result = formatMemoryForPrompt({ global: "GLOBAL_MARKER", project: "PROJECT_MARKER" });
    expect(result.indexOf("GLOBAL_MARKER")).toBeLessThan(result.indexOf("PROJECT_MARKER"));
  });
});
