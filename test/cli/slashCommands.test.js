import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { handleSlashCommand, discoverCustomSlashCommands } from "../../src/cli/slashCommands.js";

describe("Slash Commands System", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-slash-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("ignores non-slash inputs", () => {
    const result = handleSlashCommand("hello world", { cwd: tmpDir });
    expect(result.handled).toBe(false);
  });

  it("handles /help command", () => {
    const rendered = [];
    const result = handleSlashCommand("/help", {
      cwd: tmpDir,
      renderText: (msg) => rendered.push(msg),
    });

    expect(result.handled).toBe(true);
    expect(result.action).toBe("help");
    expect(rendered.some((line) => line.includes("/review"))).toBe(true);
  });

  it("handles /plan toggle command", () => {
    const config = { planMode: false };
    const rendered = [];
    const result = handleSlashCommand("/plan", {
      cwd: tmpDir,
      config,
      renderText: (msg) => rendered.push(msg),
    });

    expect(result.handled).toBe(true);
    expect(config.planMode).toBe(true);
    expect(rendered.some((line) => line.includes("ENABLED"))).toBe(true);
  });

  it("expands built-in prompt commands like /review", () => {
    const result = handleSlashCommand("/review src/agent", { cwd: tmpDir });
    expect(result.handled).toBe(true);
    expect(result.expandedPrompt).toContain("src/agent");
  });

  it("discovers custom project commands from .codeagent/commands/*.md", () => {
    const cmdDir = path.join(tmpDir, ".codeagent", "commands");
    fs.mkdirSync(cmdDir, { recursive: true });
    fs.writeFileSync(
      path.join(cmdDir, "explain.md"),
      "# Explain Code\nExplain how $ARG works in plain language."
    );

    const custom = discoverCustomSlashCommands(tmpDir);
    expect(custom["/explain"]).toBeDefined();
    expect(custom["/explain"].description).toBe("Explain Code");

    const result = handleSlashCommand("/explain orchestrator.js", { cwd: tmpDir });
    expect(result.handled).toBe(true);
    expect(result.expandedPrompt).toBe("Explain how orchestrator.js works in plain language.");
  });

  it("handles unknown slash commands cleanly with error message", () => {
    const errors = [];
    const result = handleSlashCommand("/nonexistent", {
      cwd: tmpDir,
      renderError: (msg) => errors.push(msg),
    });

    expect(result.handled).toBe(true);
    expect(errors[0]).toContain("Unknown slash command: /nonexistent");
  });
});
