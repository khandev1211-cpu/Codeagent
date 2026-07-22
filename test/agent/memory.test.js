import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { discoverProjectMemory, formatMemoryForPrompt } from "../../src/agent/memory.js";
import { buildSystemPrompt } from "../../src/agent/systemPrompt.js";

describe("Project Memory System", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-memory-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty structure when no memory files exist", () => {
    const memory = discoverProjectMemory(tmpDir);
    expect(memory.rootFile).toBeNull();
    expect(memory.rootContent).toBeNull();
    expect(memory.rules).toEqual([]);
    expect(formatMemoryForPrompt(memory)).toBeNull();
  });

  it("discovers CODEAGENT.md at project root", () => {
    fs.writeFileSync(path.join(tmpDir, "CODEAGENT.md"), "# Codeagent Project Guidelines\n- Always use async/await");
    const memory = discoverProjectMemory(tmpDir);
    expect(memory.rootFile).toBe("CODEAGENT.md");
    expect(memory.rootContent).toBe("# Codeagent Project Guidelines\n- Always use async/await");

    const promptText = formatMemoryForPrompt(memory);
    expect(promptText).toContain("## Project memory & instructions");
    expect(promptText).toContain("### Instructions from CODEAGENT.md");
    expect(promptText).toContain("- Always use async/await");
  });

  it("falls back to CLAUDE.md if CODEAGENT.md is absent", () => {
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Claude Guidelines\n- Write unit tests");
    const memory = discoverProjectMemory(tmpDir);
    expect(memory.rootFile).toBe("CLAUDE.md");
    expect(memory.rootContent).toBe("# Claude Guidelines\n- Write unit tests");

    const promptText = formatMemoryForPrompt(memory);
    expect(promptText).toContain("### Instructions from CLAUDE.md");
  });

  it("discovers and sorts rules in .codeagent/rules/*.md", () => {
    const rulesDir = path.join(tmpDir, ".codeagent", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "testing.md"), "Rule: Must achieve 80% coverage");
    fs.writeFileSync(path.join(rulesDir, "style.md"), "Rule: Use ESLint standard");

    const memory = discoverProjectMemory(tmpDir);
    expect(memory.rules).toHaveLength(2);
    expect(memory.rules[0].filename).toBe("style.md");
    expect(memory.rules[1].filename).toBe("testing.md");

    const promptText = formatMemoryForPrompt(memory);
    expect(promptText).toContain("### Rule: style.md\nRule: Use ESLint standard");
    expect(promptText).toContain("### Rule: testing.md\nRule: Must achieve 80% coverage");
  });

  it("includes formatted project memory in buildSystemPrompt", () => {
    const memoryText = "## Project memory & instructions\n### Instructions from CODEAGENT.md\n- Strict type safety";
    const prompt = buildSystemPrompt({
      projectMemory: memoryText,
    });

    expect(prompt).toContain("## Project memory & instructions");
    expect(prompt).toContain("- Strict type safety");
  });
});
