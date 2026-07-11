"use strict";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import agent from "../../src/agent/orchestrator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testFilePath = join(__dirname, "__test__", "example.js");

// Mock the agent's tool calls to avoid actual file system modifications
vi.mock("../../src/tools/registry", () => ({
  default: {
    editFile: vi.fn(),
    writeFile: vi.fn(),
    runBash: vi.fn(),
    readFile: vi.fn(),
    listDir: vi.fn(),
    searchCode: vi.fn(),
  },
}));

// Mock the safety confirmation to auto-confirm for tests
vi.mock("../../src/safety/confirm", () => ({
  default: vi.fn(() => Promise.resolve(true)),
}));

// Setup a test file before each test
beforeEach(() => {
  const testDir = join(__dirname, "__test__");
  if (!existsSync(testDir)) {
    require("node:fs").mkdirSync(testDir);
  }
  writeFileSync(
    testFilePath,
    `export function greet(name) {
  return \`Hello, ${name}!\`;
}`
  );
});

// Cleanup after each test
afterEach(() => {
  if (existsSync(testFilePath)) {
    unlinkSync(testFilePath);
  }
  vi.clearAllMocks();
});

describe("Agent Coding Capabilities (E2E)", () => {
  it("should add a new function to an existing file", async () => {
    const goal = "Add a new function called 'farewell' that takes a name and returns 'Goodbye, {name}!'.";
    const sessionId = "test-session";
    
    // Mock the agent's tool calls
    const { editFile } = require("../../src/tools/registry").default;
    editFile.mockImplementation(({ new_content }) => {
      // Simulate the file edit
      writeFileSync(testFilePath, new_content);
      return Promise.resolve({ success: true });
    });
    
    // Mock readFile to return the test file's content
    const { readFile } = require("../../src/tools/registry").default;
    readFile.mockImplementation(() => {
      return Promise.resolve({ content: readFileSync(testFilePath, "utf-8") });
    });
    
    // Run the agent
    await agent.run({ goal, sessionId });
    
    // Verify the file was edited correctly
    const updatedContent = readFileSync(testFilePath, "utf-8");
    expect(updatedContent).toContain("function farewell(name)");
    expect(updatedContent).toContain("return \`Goodbye, ${name}!\`;");
    expect(editFile).toHaveBeenCalled();
  });
});