import { describe, it, expect } from "vitest";
import { runSubagent } from "../../src/tools/runSubagent.js";
import { SubagentRegistry } from "../../src/agent/subagentRegistry.js";

const SAMPLE = [{ name: "reviewer", description: "Reviews a diff.", tools: null, instructions: "Review it.", path: "p" }];

describe("runSubagent tool", () => {
  it("is non-destructive — nested destructive calls are independently gated (docs/22)", () => {
    expect(runSubagent.destructive).toBe(false);
  });

  it("errors when no subagentRegistry is present in ctx", async () => {
    const result = await runSubagent.execute({ name: "reviewer", task: "t" }, {});
    expect(result.ok).toBe(false);
  });

  it("errors with the list of available names when the requested subagent doesn't exist", async () => {
    const subagentRegistry = new SubagentRegistry({ subagents: SAMPLE });
    const result = await runSubagent.execute({ name: "nonexistent", task: "t" }, { subagentRegistry });
    expect(result.ok).toBe(false);
    expect(result.available).toEqual(["reviewer"]);
  });

  it("errors when runSubagentTurn isn't provided (e.g. a stripped-down ctx)", async () => {
    const subagentRegistry = new SubagentRegistry({ subagents: SAMPLE });
    const result = await runSubagent.execute({ name: "reviewer", task: "t" }, { subagentRegistry });
    expect(result.ok).toBe(false);
  });

  it("delegates to ctx.runSubagentTurn with the resolved definition and returns its result", async () => {
    const subagentRegistry = new SubagentRegistry({ subagents: SAMPLE });
    let capturedArgs;
    const runSubagentTurn = async (definition, task, cwd) => {
      capturedArgs = { definition, task, cwd };
      return { finalText: "review complete", iterations: 2, usage: { inputTokens: 10, outputTokens: 5 } };
    };
    const result = await runSubagent.execute(
      { name: "reviewer", task: "review this diff" },
      { subagentRegistry, runSubagentTurn, cwd: "/project" }
    );
    expect(result).toEqual({
      ok: true,
      subagent: "reviewer",
      finalText: "review complete",
      iterations: 2,
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    expect(capturedArgs.definition.name).toBe("reviewer");
    expect(capturedArgs.task).toBe("review this diff");
    expect(capturedArgs.cwd).toBe("/project");
  });
});
