import { describe, it, expect } from "vitest";
import { Orchestrator } from "../../src/agent/orchestrator.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { RECITATION_INTERVAL } from "../../src/agent/planner.js";

function fakeProvider(responses) {
  let call = 0;
  const calls = [];
  return {
    async send(messages, tools, opts) {
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

const harmlessTool = {
  name: "noop",
  description: "does nothing",
  destructive: false,
  input_schema: { type: "object", properties: {} },
  async execute() {
    return { ok: true };
  },
};

const alwaysAllow = async () => ({ allowed: true });

describe("Orchestrator + Autonomous Mode recitation (real end-to-end loop, not mocked internals)", () => {
  it("recites the plan as a plain user-role message at the configured interval, not before", async () => {
    const plan = "1. Read the file\n2. Fix the bug\n3. Run the tests";

    // RECITATION_INTERVAL (5) tool_use responses to walk iterations
    // 0 -> 5, then one final plain-text response to end the turn cleanly.
    const responses = [
      ...Array.from({ length: RECITATION_INTERVAL }, (_, i) => ({
        content: [{ type: "tool_use", id: String(i), name: "noop", input: {} }],
        usage: {},
        stopReason: "tool_use",
      })),
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
    ];

    const provider = fakeProvider(responses);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([harmlessTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 20, autonomousMode: true },
    });

    await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project", plan });

    // The call made when iterations === 0 (the very first send()) must
    // NOT already contain the recitation — nothing to recite yet.
    const firstCallText = JSON.stringify(provider._calls[0].messages);
    expect(firstCallText).not.toMatch(/Reminder/);

    // The call made when iterations === RECITATION_INTERVAL (the 6th
    // send(), index 5) is the one where the recitation should have just
    // been injected into history before this exact call.
    const recitationCall = provider._calls[RECITATION_INTERVAL];
    const recitationMessage = recitationCall.messages.find(
      (m) => m.role === "user" && typeof m.content === "string" && m.content.includes("Reminder")
    );
    expect(recitationMessage).toBeDefined();
    expect(recitationMessage.content).toContain(plan);
  });

  it("does not recite at all when autonomousMode is false, even with a plan provided", async () => {
    const plan = "1. Step one\n2. Step two\n3. Step three\n4. Step four\n5. Step five\n6. Step six";
    const responses = [
      ...Array.from({ length: RECITATION_INTERVAL + 1 }, (_, i) => ({
        content: [{ type: "tool_use", id: String(i), name: "noop", input: {} }],
        usage: {},
        stopReason: "tool_use",
      })),
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
    ];
    const provider = fakeProvider(responses);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([harmlessTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 20, autonomousMode: false },
    });

    await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project", plan });

    const anyRecitation = provider._calls.some((c) => JSON.stringify(c.messages).includes("Reminder"));
    expect(anyRecitation).toBe(false);
  });

  it("does not recite when autonomousMode is true but no plan was produced for this turn", async () => {
    const responses = [
      ...Array.from({ length: RECITATION_INTERVAL + 1 }, (_, i) => ({
        content: [{ type: "tool_use", id: String(i), name: "noop", input: {} }],
        usage: {},
        stopReason: "tool_use",
      })),
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
    ];
    const provider = fakeProvider(responses);
    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([harmlessTool]),
      confirm: alwaysAllow,
      config: { maxIterationsPerTurn: 20, autonomousMode: true },
    });

    // plan defaults to null when not passed.
    await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project" });

    const anyRecitation = provider._calls.some((c) => JSON.stringify(c.messages).includes("Reminder"));
    expect(anyRecitation).toBe(false);
  });

  it("destructive tool calls still go through confirm() in Autonomous Mode — the mechanism isn't bypassed, only the outcome is pre-approved by config", async () => {
    const destructiveTool = {
      name: "destroy",
      description: "d",
      destructive: true,
      input_schema: { type: "object", properties: {} },
      async execute() {
        return { ok: true };
      },
    };
    const responses = [
      { content: [{ type: "tool_use", id: "1", name: "destroy", input: {} }], usage: {}, stopReason: "tool_use" },
      { content: [{ type: "text", text: "done" }], usage: {}, stopReason: "end_turn" },
    ];
    const provider = fakeProvider(responses);

    let confirmCalls = 0;
    const trackingConfirm = async () => {
      confirmCalls += 1;
      return { allowed: true };
    };

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: new ToolRegistry([destructiveTool]),
      confirm: trackingConfirm,
      config: { maxIterationsPerTurn: 20, autonomousMode: true },
    });

    await orchestrator.runTurn({ messages: [], userInput: "go", system: "sys", cwd: "/project" });

    // confirm() is still the mechanism that runs — Autonomous Mode
    // doesn't skip the Orchestrator's own dispatch path, it's whatever
    // policy `confirm` implements (auto-approve, via yolo/autonomousMode
    // in src/safety/yolo.js) that decides the outcome. This proves there
    // is no separate, uninstrumented bypass route.
    expect(confirmCalls).toBe(1);
  });
});
