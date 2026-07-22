import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { discoverSubagents, SubagentRunner } from "../../src/agent/subagent.js";
import { runSubagentTool } from "../../src/tools/runSubagent.js";

describe("Subagents Framework", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-subagent-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers custom subagents from .codeagent/agents/*.md", () => {
    const agentsDir = path.join(tmpDir, ".codeagent", "agents");
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, "reviewer.md"),
      `---
name: reviewer
description: Code quality reviewer
allowed-tools: read_file
---
Review code for vulnerabilities.`
    );

    const discovered = discoverSubagents(tmpDir);
    expect(discovered.reviewer).toBeDefined();
    expect(discovered.reviewer.description).toBe("Code quality reviewer");
    expect(discovered.reviewer.allowedTools).toEqual(["read_file"]);
    expect(discovered.reviewer.prompt).toContain("Review code for vulnerabilities.");
  });

  it("runs subagent with mock provider and returns output summary", async () => {
    const mockProvider = {
      async send(history, schemas, { system }) {
        return {
          content: [{ type: "text", text: "Summary: Code structure is clean." }],
          usage: { inputTokens: 50, outputTokens: 20 },
        };
      },
    };

    const runner = new SubagentRunner({
      provider: mockProvider,
      config: { maxIterationsPerTurn: 5 },
      cwd: tmpDir,
    });

    const result = await runner.run({
      agentName: "general-researcher",
      task: "Analyze directory structure",
    });

    expect(result.agent).toBe("general-researcher");
    expect(result.summary).toContain("Summary: Code structure is clean.");
  });

  it("executes run_subagent tool correctly", async () => {
    const mockProvider = {
      async send() {
        return {
          content: [{ type: "text", text: "Analysis completed." }],
          usage: { inputTokens: 10, outputTokens: 5 },
        };
      },
    };

    const output = await runSubagentTool.execute(
      { agent: "general-researcher", task: "Check docs" },
      { cwd: tmpDir, config: { provider: mockProvider } }
    );

    expect(output).toContain("Subagent 'general-researcher' output:");
    expect(output).toContain("Analysis completed.");
  });
});
