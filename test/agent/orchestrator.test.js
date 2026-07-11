import { describe, it, expect } from "vitest";
import { Orchestrator } from "../../src/agent/orchestrator.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { LimitExceededError } from "../../src/utils/errors.js";

function fakeProvider(responses) {
  let call = 0;
  return {
    async send() {
      const r = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return r;
    },
    countTokens() {
      return 100;
    },
  };
}

const echoTool = {
  name: "echo_tool",
  description: "echoes input",
  destructive: false,
  input_schema: { type: "object", properties: {} },
  async execute(input) {
    return { ok: true, echoed: input };
  },
};

const throwingTool = {
  name: "throwing_tool",
  description: "always throws",
  destructive: false,
  input_schema: { type: "object", properties: {} },
  async execute() {
    throw new Error("boom");
  },
};

const alwaysAllow = async () => ({ allowed: true });
const alwaysDecline = async () => ({ allowed: false, reason: "declined" });

describe("Orchestrator.runTurn", () => {
  it("returns final text when the model responds with no tool calls", async () => {
    const provider = fakeProvider([
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
    ]);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 5 },
      logger: undefined,
    });
    const events = [];
    const result = await orchestrator.runTurn({
      messages: [],
      userInput: "hi",
      system: "sys",
      cwd: "/tmp",
      onEvent: (e) => events.push(e),
    });
    expect(events.find((e) => e.type === "final_text").text).toBe("done");
    expect(result.history.at(-1).role).toBe("assistant");
  });

  it("executes a tool call and loops back with the result", async () => {
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "echo_tool", input: { a: 1 } }],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "all set" }], usage: {}, stopReason: "end_turn" },
    ]);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([echoTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 5 },
    });
    const result = await orchestrator.runTurn({
      messages: [],
      userInput: "do it",
      system: "sys",
      cwd: "/tmp",
    });
    expect(result.iterations).toBe(1);
    const toolResultMsg = result.history.find(
      (m) => Array.isArray(m.content) && m.content[0]?.type === "tool_result"
    );
    expect(toolResultMsg.content[0].is_error).toBe(false);
  });

  it("synthesizes a tool_result when a destructive call is declined", async () => {
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "echo_tool", input: {} }],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([echoTool]),
      confirm: alwaysDecline,
      config: { maxIterationsPerTurn: 5 },
    });
    const result = await orchestrator.runTurn({ messages: [], userInput: "x", system: "s", cwd: "/tmp" });
    const toolResultMsg = result.history.find(
      (m) => Array.isArray(m.content) && m.content[0]?.type === "tool_result"
    );
    expect(toolResultMsg.content[0].is_error).toBe(true);
    expect(toolResultMsg.content[0].content).toMatch(/declined/);
  });

  it("converts a thrown tool error into a tool_result instead of crashing", async () => {
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "throwing_tool", input: {} }],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "recovered" }], usage: {}, stopReason: "end_turn" },
    ]);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([throwingTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 5 },
      logger: { error: () => {} },
    });
    const result = await orchestrator.runTurn({ messages: [], userInput: "x", system: "s", cwd: "/tmp" });
    const toolResultMsg = result.history.find(
      (m) => Array.isArray(m.content) && m.content[0]?.type === "tool_result"
    );
    expect(toolResultMsg.content[0].content).toMatch(/boom/);
  });

  it("throws LimitExceededError once max iterations is hit", async () => {
    const loopingResponse = {
      content: [{ type: "tool_use", id: "1", name: "echo_tool", input: {} }],
      usage: {},
      stopReason: "tool_use",
    };
    const provider = fakeProvider([loopingResponse]);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([echoTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 2 },
    });
    await expect(
      orchestrator.runTurn({ messages: [], userInput: "x", system: "s", cwd: "/tmp" })
    ).rejects.toThrow(LimitExceededError);
  });
});

describe("Orchestrator.runTurn with hooks (Phase 3 / doc 16)", () => {
  it("skips confirm() and execute() entirely when a PreToolUse hook blocks", async () => {
    let confirmCalled = false;
    let executeCalled = false;
    const trackedTool = {
      ...echoTool,
      async execute(input) {
        executeCalled = true;
        return { ok: true, echoed: input };
      },
    };
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "echo_tool", input: {} }],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);
    const hookRegistry = {
      async run(event) {
        if (event === "PreToolUse") return { blocked: true, reason: "policy says no", context: null };
        return { blocked: false, reason: null, context: null };
      },
    };
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([trackedTool]),
      confirm: async () => {
        confirmCalled = true;
        return { allowed: true };
      },
      config: { maxIterationsPerTurn: 5 },
      hookRegistry,
    });
    const events = [];
    const result = await orchestrator.runTurn({
      messages: [],
      userInput: "x",
      system: "s",
      cwd: "/tmp",
      onEvent: (e) => events.push(e),
    });

    expect(confirmCalled).toBe(false);
    expect(executeCalled).toBe(false);
    expect(events.some((e) => e.type === "tool_blocked" && e.reason === "policy says no")).toBe(true);
    const toolResultMsg = result.history.find(
      (m) => Array.isArray(m.content) && m.content[0]?.type === "tool_result"
    );
    expect(toolResultMsg.content[0].is_error).toBe(true);
    expect(toolResultMsg.content[0].content).toMatch(/policy says no/);
  });

  it("appends PostToolUse hook context to the tool_result content without failing the call", async () => {
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "echo_tool", input: {} }],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);
    const hookRegistry = {
      async run(event) {
        if (event === "PostToolUse") {
          return { blocked: false, reason: null, context: "formatted with prettier" };
        }
        return { blocked: false, reason: null, context: null };
      },
    };
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([echoTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 5 },
      hookRegistry,
    });
    const result = await orchestrator.runTurn({ messages: [], userInput: "x", system: "s", cwd: "/tmp" });
    const toolResultMsg = result.history.find(
      (m) => Array.isArray(m.content) && m.content[0]?.type === "tool_result"
    );
    expect(toolResultMsg.content[0].is_error).toBe(false);
    expect(toolResultMsg.content[0].content).toMatch(/formatted with prettier/);
  });

  it("logs but does not fail the call when a PostToolUse hook signals block after execution", async () => {
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "echo_tool", input: {} }],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "ok" }], usage: {}, stopReason: "end_turn" },
    ]);
    const warnings = [];
    const hookRegistry = {
      async run(event) {
        if (event === "PostToolUse") return { blocked: true, reason: "too late", context: null };
        return { blocked: false, reason: null, context: null };
      },
    };
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([echoTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 5 },
      hookRegistry,
      logger: { warn: (msg, meta) => warnings.push({ msg, meta }) },
    });
    const result = await orchestrator.runTurn({ messages: [], userInput: "x", system: "s", cwd: "/tmp" });
    const toolResultMsg = result.history.find(
      (m) => Array.isArray(m.content) && m.content[0]?.type === "tool_result"
    );
    expect(toolResultMsg.content[0].is_error).toBe(false);
    expect(warnings.some((w) => w.msg.includes("PostToolUse hook signaled block"))).toBe(true);
  });

  it("defaults to the null hook registry and behaves exactly as before when none is provided", async () => {
    const provider = fakeProvider([
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
    ]);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 5 },
    });
    const result = await orchestrator.runTurn({ messages: [], userInput: "hi", system: "sys", cwd: "/tmp" });
    expect(result.history.at(-1).role).toBe("assistant");
  });
});
