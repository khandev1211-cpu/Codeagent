import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "ink-testing-library";
import { App } from "../../../src/cli/tui/App.js";
import { h } from "../../../src/cli/tui/h.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { NULL_HOOK_REGISTRY } from "../../../src/hooks/index.js";
import { SkillRegistry } from "../../../src/skills/index.js";

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const quietLogger = { warn: () => {}, debug: () => {}, info: () => {} };

function fakeProvider(text) {
  return {
    async send() {
      return { content: [{ type: "text", text }], usage: {}, stopReason: "end_turn" };
    },
    countTokens: () => 10,
  };
}

function fakeSessionStore() {
  return { syncDiffTracker: () => {}, save: async () => {} };
}

function baseProps(overrides = {}) {
  return {
    provider: fakeProvider("reply from anthropic"),
    toolRegistry: new ToolRegistry([]),
    config: { maxIterationsPerTurn: 5, provider: "anthropic", model: "claude-sonnet-5" },
    logger: quietLogger,
    session: { id: "test-session", messages: [] },
    sessionStore: fakeSessionStore(),
    diffTracker: {},
    cwd: "/tmp/test-project",
    hookRegistry: NULL_HOOK_REGISTRY,
    permissionRules: [],
    skillRegistry: new SkillRegistry({ skills: [] }),
    projectContext: {},
    configuredProviders: {
      anthropic: { apiKeyEnvVar: "ANTHROPIC_API_KEY", model: "claude-sonnet-5" },
      mistral: { apiKeyEnvVar: "MISTRAL_API_KEY", model: "codestral-latest" },
    },
    ...overrides,
  };
}

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("renders the status header with the initial model/provider", () => {
    const { lastFrame } = render(h(App, baseProps()));
    const frame = lastFrame();
    expect(frame).toContain("claude-sonnet-5");
    expect(frame).toContain("anthropic");
  });

  it("submitting a message runs a real turn and shows the reply", async () => {
    const { stdin, lastFrame } = render(h(App, baseProps()));
    stdin.write("add a login form");
    await wait(50); // let the controlled TextInput's value actually commit before Enter
    stdin.write("\r");
    await wait(100);
    const frame = lastFrame();
    expect(frame).toContain("add a login form");
    expect(frame).toContain("reply from anthropic");
  });

  it("Tab opens the model switcher", async () => {
    const { stdin, lastFrame } = render(h(App, baseProps()));
    stdin.write("\t"); // Tab
    await wait();
    expect(lastFrame()).toContain("Switch model");
  });

  it("Escape from the switcher returns to the normal session view without changing the provider", async () => {
    const { stdin, lastFrame } = render(h(App, baseProps()));
    stdin.write("\t");
    await wait();
    stdin.write("\u001B"); // escape
    await wait();
    const frame = lastFrame();
    expect(frame).not.toContain("Switch model");
    expect(frame).toContain("claude-sonnet-5"); // unchanged
  });

  it("selecting a different provider in the switcher actually routes the next turn through it", async () => {
    vi.doMock("../../../src/providers/index.js", () => ({
      getProvider: (config) => {
        if (config.provider === "mistral") return fakeProvider("reply from mistral");
        return fakeProvider("reply from anthropic");
      },
    }));
    vi.resetModules();
    const { App: MockedApp } = await import("../../../src/cli/tui/App.js");
    const { h: mockedH } = await import("../../../src/cli/tui/h.js");

    const { stdin, lastFrame } = render(mockedH(MockedApp, baseProps()));

    // Open switcher, move to mistral (second option), select it.
    stdin.write("\t");
    await wait();
    stdin.write("\u001B[B"); // down to mistral
    stdin.write("\r"); // select
    await wait();

    expect(lastFrame()).toContain("Switched to mistral");
    expect(lastFrame()).toContain("codestral-latest");

    // Now submit a message — it should go through the NEW provider.
    stdin.write("do something");
    await wait(50);
    stdin.write("\r");
    await wait(100);

    const frame = lastFrame();
    expect(frame).toContain("reply from mistral");
    expect(frame).not.toContain("reply from anthropic");
  });

  it("disables the input and shows a working indicator while a turn is in flight", async () => {
    let resolveTurn;
    const slowProvider = {
      send: () => new Promise((resolve) => { resolveTurn = resolve; }),
      countTokens: () => 10,
    };
    const { stdin, lastFrame } = render(h(App, baseProps({ provider: slowProvider })));
    stdin.write("slow request");
    await wait(50);
    stdin.write("\r");
    await wait(30);
    expect(lastFrame()).toContain("working");
    resolveTurn({ content: [{ type: "text", text: "finally done" }], usage: {}, stopReason: "end_turn" });
    await wait(30);
    expect(lastFrame()).toContain("finally done");
  });
});
