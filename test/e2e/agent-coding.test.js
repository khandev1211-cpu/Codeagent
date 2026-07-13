import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Orchestrator } from "../../src/agent/orchestrator.js";
import { createDefaultRegistry } from "../../src/tools/index.js";
import { createConfirmer } from "../../src/safety/confirm.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname, "__test__");
const testFilePath = join(testDir, "example.js");

// The file content we seed on disk. The \${name} is escaped so it is written
// as the literal text "${name}" rather than interpolated by this template.
const originalContent = `export function greet(name) {
  return \`Hello, \${name}!\`;
}`;

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

beforeEach(() => {
  if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });
  writeFileSync(testFilePath, originalContent);
});

afterEach(() => {
  if (existsSync(testFilePath)) unlinkSync(testFilePath);
});

describe("Agent Coding Capabilities (E2E)", () => {
  it("should add a new function to an existing file", async () => {
    const newContent = `export function greet(name) {
  return \`Hello, \${name}!\`;
}

export function farewell(name) {
  return \`Goodbye, \${name}!\`;
}
`;

    // Simulate the model deciding to edit the file via the real edit_file tool.
    const provider = fakeProvider([
      {
        content: [
          {
            type: "tool_use",
            id: "1",
            name: "edit_file",
            input: {
              path: "example.js",
              old_content: originalContent,
              new_content: newContent,
            },
          },
        ],
        usage: {},
        stopReason: "tool_use",
      },
      { content: [{ type: "text", text: "Done." }], usage: {}, stopReason: "end_turn" },
    ]);

    const orchestrator = new Orchestrator({
      provider,
      toolRegistry: createDefaultRegistry(),
      confirm: createConfirmer({ config: { yolo: true } }),
      config: { maxIterationsPerTurn: 5, yolo: true, allowedWritePaths: ["."] },
      logger: undefined,
    });

    await orchestrator.runTurn({
      messages: [],
      userInput: "Add a farewell function",
      system: "sys",
      cwd: testDir,
    });

    const updatedContent = readFileSync(testFilePath, "utf-8");
    expect(updatedContent).toContain("function farewell(name)");
    expect(updatedContent).toContain("return `Goodbye, ${name}!`;");
  });
});