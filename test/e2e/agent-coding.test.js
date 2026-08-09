import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Orchestrator } from "../../src/agent/orchestrator.js";
import { createDefaultRegistry } from "../../src/tools/index.js";
import { createConfirmer } from "../../src/safety/confirm.js";

/**
 * A real end-to-end test: real ToolRegistry, real tools (actual file I/O
 * against a temp directory), real Orchestrator loop, real Safety Layer
 * (bypassed via yolo — no human present in CI, same as any non-interactive
 * run per docs/07). The only thing faked is the LLM boundary itself, since
 * that's the one piece that can't run in CI without a real API key.
 *
 * This file previously imported a nonexistent default-exported `agent`
 * object (orchestrator.js exports a named `Orchestrator` class), mocked
 * `tools/registry` as a flat object of functions instead of the real
 * class-based ToolRegistry, and used `require()` inside an ESM module. It
 * never actually ran — the mismatch was caught and diagnosed, then fixed
 * here by testing against the real APIs instead of a guessed shape.
 */
function fakeProvider(responses) {
  let call = 0;
  return {
    async send() {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return response;
    },
    countTokens: () => 10,
  };
}

const quietLogger = { warn: () => {}, debug: () => {}, info: () => {} };

describe("Agent Coding Capabilities (E2E)", () => {
  let tmpDir;
  let testFilePath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-e2e-"));
    testFilePath = path.join(tmpDir, "example.js");
    fs.writeFileSync(
      testFilePath,
      `export function greet(name) {\n  return \`Hello, \${name}!\`;\n}\n`
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds a new function to an existing file via a real edit_file call", async () => {
    const originalContent = fs.readFileSync(testFilePath, "utf-8");
    const newContent =
      originalContent +
      "\nexport function farewell(name) {\n  return `Goodbye, ${name}!`;\n}\n";

    // Script the model: first it reads the file, then it edits it, then
    // it's done. Each step is a separate scripted response, mirroring how
    // orchestrator.test.js drives the fake provider elsewhere in this repo.
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "read_file", input: { path: "example.js" } }],
        usage: {},
        stopReason: "tool_use",
      },
      {
        content: [
          {
            type: "tool_use",
            id: "2",
            name: "edit_file",
            input: { path: "example.js", old_content: originalContent, new_content: newContent },
          },
        ],
        usage: {},
        stopReason: "tool_use",
      },
      {
        content: [{ type: "text", text: "Added the farewell function." }],
        usage: {},
        stopReason: "end_turn",
      },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: createDefaultRegistry(),
      confirm: createConfirmer({ config: { yolo: true }, logger: quietLogger }),
      config: { maxIterationsPerTurn: 10 },
      logger: quietLogger,
    });

    const goal = "Add a new function called 'farewell' that takes a name and returns 'Goodbye, {name}!'.";
    const result = await orchestrator.runTurn({
      messages: [],
      userInput: goal,
      system: "You are a coding agent.",
      cwd: tmpDir,
    });

    // The real file on disk, not a mock's recorded call — this is what
    // makes it an end-to-end test rather than a unit test with extra steps.
    const updatedContent = fs.readFileSync(testFilePath, "utf-8");
    expect(updatedContent).toContain("function farewell(name)");
    expect(updatedContent).toContain("return `Goodbye, ${name}!`;");
    expect(updatedContent).toContain("function greet(name)"); // original content preserved

    const finalMessage = result.history.at(-1);
    expect(finalMessage.role).toBe("assistant");
  });

  it("does not modify the file if the model only reads it", async () => {
    const originalContent = fs.readFileSync(testFilePath, "utf-8");
    const provider = fakeProvider([
      {
        content: [{ type: "tool_use", id: "1", name: "read_file", input: { path: "example.js" } }],
        usage: {},
        stopReason: "tool_use",
      },
      {
        content: [{ type: "text", text: "The file defines a single greet function." }],
        usage: {},
        stopReason: "end_turn",
      },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: createDefaultRegistry(),
      confirm: createConfirmer({ config: { yolo: true }, logger: quietLogger }),
      config: { maxIterationsPerTurn: 10 },
      logger: quietLogger,
    });

    await orchestrator.runTurn({
      messages: [],
      userInput: "What does example.js do?",
      system: "You are a coding agent.",
      cwd: tmpDir,
    });

    expect(fs.readFileSync(testFilePath, "utf-8")).toBe(originalContent);
  });

  it("a write_file call actually creates a new file on disk", async () => {
    const newFilePath = path.join(tmpDir, "utils.js");
    const provider = fakeProvider([
      {
        content: [
          {
            type: "tool_use",
            id: "1",
            name: "write_file",
            input: { path: "utils.js", content: "export const PI = 3.14159;\n" },
          },
        ],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "Created utils.js." }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: createDefaultRegistry(),
      confirm: createConfirmer({ config: { yolo: true }, logger: quietLogger }),
      config: { maxIterationsPerTurn: 10 },
      logger: quietLogger,
    });

    expect(fs.existsSync(newFilePath)).toBe(false);
    await orchestrator.runTurn({
      messages: [],
      userInput: "Create a utils.js file with a PI constant.",
      system: "You are a coding agent.",
      cwd: tmpDir,
    });

    expect(fs.existsSync(newFilePath)).toBe(true);
    expect(fs.readFileSync(newFilePath, "utf-8")).toContain("PI = 3.14159");
  });
});
