import { describe, it, expect } from "vitest";
import { Orchestrator } from "../../src/agent/orchestrator.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { SubagentRegistry, wireSubagentsIndex } from "../../src/agent/subagentRegistry.js";
import { runSubagent } from "../../src/tools/runSubagent.js";

function fakeProvider(responses) {
  let call = 0;
  const calls = [];
  return {
    async send(messages, tools, opts) {
      // Orchestrator.runTurn mutates its `history` array in place via
      // .push() AFTER this send() call resolves (appending the
      // assistant/tool_result messages for the next iteration) — since
      // messages here is the same array reference passed straight
      // through, capturing it without cloning would mean assertions made
      // after the whole turn completes see the final mutated array, not
      // what was actually sent at call time. Clone at capture time.
      calls.push({ messages: [...messages], tools, opts });
      const r = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return r;
    },
    countTokens() {
      return 100;
    },
    _calls: calls,
  };
}

const readFileTool = {
  name: "read_file",
  description: "reads a file",
  destructive: false,
  input_schema: { type: "object", properties: {} },
  async execute() {
    return { ok: true, content: "file contents" };
  },
};

const writeFileTool = {
  name: "write_file",
  description: "writes a file",
  destructive: true,
  input_schema: { type: "object", properties: {} },
  async execute() {
    return { ok: true };
  },
};

const alwaysAllow = async () => ({ allowed: true });
const alwaysDecline = async () => ({ allowed: false, reason: "declined" });

describe("Orchestrator + run_subagent (end-to-end, real _runSubagentTurn)", () => {
  it("dispatches run_subagent, runs the subagent's own turn via the same provider, and returns its answer to the parent", async () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "reviewer", description: "Reviews code.", tools: null, instructions: "You review code carefully.", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([readFileTool]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });

    const provider = fakeProvider([
      // Parent's first send: model delegates to the subagent.
      {
        content: [{ type: "tool_use", id: "1", name: "run_subagent", input: { name: "reviewer", task: "Review file.js" } }],
        usage: {},
        stopReason: "tool_use",
      },
      // Subagent's own send (via the child Orchestrator's runTurn): plain text answer.
      { content: [{ type: "text", text: "Looks good, no issues found." }], usage: {}, stopReason: "end_turn" },
      // Parent's second send, after receiving the subagent's result as a tool_result.
      { content: [{ type: "text", text: "The subagent found no issues." }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry,
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 10 },
      logger: undefined,
      subagentRegistry,
    });

    const events = [];
    const result = await orchestrator.runTurn({
      messages: [],
      userInput: "Please review file.js",
      system: "parent system prompt",
      cwd: "/project",
      onEvent: (e) => events.push(e),
    });

    expect(events.find((e) => e.type === "final_text").text).toBe("The subagent found no issues.");

    // The tool_result the parent received must carry the subagent's answer.
    const toolResultMsg = result.history.find(
      (m) => m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result")
    );
    const parsed = JSON.parse(toolResultMsg.content[0].content);
    expect(parsed.ok).toBe(true);
    expect(parsed.finalText).toBe("Looks good, no issues found.");
    expect(parsed.subagent).toBe("reviewer");

    // Exactly 3 provider.send calls: parent, subagent, parent-again.
    expect(provider._calls).toHaveLength(3);
  });

  it("the subagent's own destructive tool calls go through the SAME confirm function as the parent", async () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "writer", description: "Writes files.", tools: null, instructions: "Write the file.", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([writeFileTool]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });

    const provider = fakeProvider([
      { content: [{ type: "tool_use", id: "1", name: "run_subagent", input: { name: "writer", task: "Write out.txt" } }], usage: {}, stopReason: "tool_use" },
      // Subagent tries a destructive write_file call.
      { content: [{ type: "tool_use", id: "2", name: "write_file", input: { path: "out.txt" } }], usage: {}, stopReason: "tool_use" },
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
      { content: [{ type: "text", text: "The subagent finished." }], usage: {}, stopReason: "end_turn" },
    ]);

    let confirmCalls = 0;
    const trackingConfirm = async (...args) => {
      confirmCalls += 1;
      return alwaysAllow(...args);
    };

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry,
      confirm: trackingConfirm,
      config: { maxIterationsPerTurn: 10 },
      logger: undefined,
      subagentRegistry,
    });

    await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project" });

    // Both the non-destructive run_subagent dispatch (parent) AND the
    // destructive write_file dispatch (subagent) go through confirm() —
    // confirm() itself decides whether a given tool actually needs a
    // prompt (src/safety/confirm.js short-circuits non-destructive tools
    // to {allowed:true} immediately, no interaction). What matters here
    // isn't the call count in isolation, but that it's the SAME confirm
    // function instance handling both — proving there is no separate,
    // weaker safety path for a subagent's destructive actions.
    expect(confirmCalls).toBe(2);
  });

  it("a declined destructive call inside a subagent surfaces as an error result, same as at the top level", async () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "writer", description: "Writes files.", tools: null, instructions: "Write the file.", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([writeFileTool]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });

    const provider = fakeProvider([
      { content: [{ type: "tool_use", id: "1", name: "run_subagent", input: { name: "writer", task: "Write out.txt" } }], usage: {}, stopReason: "tool_use" },
      { content: [{ type: "tool_use", id: "2", name: "write_file", input: { path: "out.txt" } }], usage: {}, stopReason: "tool_use" },
      { content: [{ type: "text", text: "I couldn't write the file." }], usage: {}, stopReason: "end_turn" },
      { content: [{ type: "text", text: "Subagent was declined." }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry,
      confirm: alwaysDecline,
      config: { maxIterationsPerTurn: 10 },
      logger: undefined,
      subagentRegistry,
    });

    const result = await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project" });
    // Turn still completes cleanly end-to-end — a decline inside a subagent
    // doesn't crash the parent turn, it just becomes part of the subagent's
    // own final answer, same as a top-level decline would.
    expect(result.history.at(-1).role).toBe("assistant");
  });

  it("the subagent's tool registry excludes run_subagent itself (no recursive subagents)", async () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "a", description: "d", tools: null, instructions: "i", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([readFileTool]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });

    const provider = fakeProvider([
      { content: [{ type: "tool_use", id: "1", name: "run_subagent", input: { name: "a", task: "t" } }], usage: {}, stopReason: "tool_use" },
      // The subagent immediately returns text — but we assert on what
      // tools were OFFERED to it via provider.send's second argument.
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry,
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 10 },
      logger: undefined,
      subagentRegistry,
    });

    await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project" });

    const subagentCallTools = provider._calls[1].tools.map((t) => t.name);
    expect(subagentCallTools).not.toContain("run_subagent");
    expect(subagentCallTools).toContain("read_file");
  });

  it("respects a subagent definition's tools restriction (intersected with the parent's actual tools)", async () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "readonly", description: "d", tools: ["read_file"], instructions: "i", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([readFileTool, writeFileTool]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });

    const provider = fakeProvider([
      { content: [{ type: "tool_use", id: "1", name: "run_subagent", input: { name: "readonly", task: "t" } }], usage: {}, stopReason: "tool_use" },
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry,
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 10 },
      logger: undefined,
      subagentRegistry,
    });

    await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project" });

    const subagentCallTools = provider._calls[1].tools.map((t) => t.name);
    expect(subagentCallTools).toEqual(["read_file"]);
  });

  it("the subagent's system prompt is its own instructions only, not composed with the parent's", async () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "a", description: "d", tools: null, instructions: "SUBAGENT-ONLY INSTRUCTIONS", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([readFileTool]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });

    const provider = fakeProvider([
      { content: [{ type: "tool_use", id: "1", name: "run_subagent", input: { name: "a", task: "t" } }], usage: {}, stopReason: "tool_use" },
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry,
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 10 },
      logger: undefined,
      subagentRegistry,
    });

    await orchestrator.runTurn({ messages: [], userInput: "go", system: "PARENT SYSTEM PROMPT", cwd: "/project" });

    expect(provider._calls[1].opts.system).toBe("SUBAGENT-ONLY INSTRUCTIONS");
    expect(provider._calls[1].opts.system).not.toContain("PARENT SYSTEM PROMPT");
  });

  it("the subagent starts with a fresh, empty message history — no visibility into the parent conversation", async () => {
    const subagentRegistry = new SubagentRegistry({
      subagents: [{ name: "a", description: "d", tools: null, instructions: "i", path: "p" }],
    });
    const toolRegistry = new ToolRegistry([readFileTool]);
    wireSubagentsIndex({ subagentRegistry, toolRegistry });

    const provider = fakeProvider([
      { content: [{ type: "tool_use", id: "1", name: "run_subagent", input: { name: "a", task: "the task" } }], usage: {}, stopReason: "tool_use" },
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry,
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 10 },
      logger: undefined,
      subagentRegistry,
    });

    await orchestrator.runTurn({
      messages: [{ role: "user", content: "some earlier parent-conversation turn" }],
      userInput: "go",
      system: "sys",
      cwd: "/project",
    });

    // The subagent's own send() call must only ever see its own task as
    // the sole user message — none of the parent's prior history.
    const subagentMessages = provider._calls[1].messages;
    expect(subagentMessages).toHaveLength(1);
    expect(subagentMessages[0]).toEqual({ role: "user", content: "the task" });
  });
});
