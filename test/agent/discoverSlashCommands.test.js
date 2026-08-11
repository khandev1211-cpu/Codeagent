import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverSlashCommands } from "../../src/agent/discoverSlashCommands.js";
import { SlashCommandRegistry } from "../../src/agent/slashCommands.js";

function writeCommand(dir, filename, content) {
  fs.writeFileSync(path.join(dir, filename), content);
}

describe("discoverSlashCommands", () => {
  let tmpDir;
  let commandsDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-commands-"));
    commandsDir = path.join(tmpDir, ".codeagent", "commands");
    fs.mkdirSync(commandsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty array when .codeagent/commands doesn't exist", () => {
    fs.rmSync(commandsDir, { recursive: true, force: true });
    expect(discoverSlashCommands({ cwd: tmpDir })).toEqual([]);
  });

  it("discovers a well-formed command definition", () => {
    writeCommand(commandsDir, "review.md", "---\nname: review\ndescription: Review a diff.\n---\nReview this: $ARGUMENTS");
    const result = discoverSlashCommands({ cwd: tmpDir });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "review", description: "Review a diff.", template: "Review this: $ARGUMENTS" });
  });

  it("skips a definition missing required fields, with a warning", () => {
    writeCommand(commandsDir, "broken.md", "---\nname: broken\n---\nNo description.");
    const warnings = [];
    const result = discoverSlashCommands({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(result).toEqual([]);
    expect(warnings.length).toBe(1);
  });

  it("skips a malformed file with a warning, without crashing the whole discovery pass", () => {
    writeCommand(commandsDir, "malformed.md", "no frontmatter here");
    writeCommand(commandsDir, "ok.md", "---\nname: ok\ndescription: fine\n---\nBody.");
    const warnings = [];
    const result = discoverSlashCommands({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(result.map((r) => r.name)).toEqual(["ok"]);
    expect(warnings.length).toBe(1);
  });

  it("ignores non-.md files", () => {
    writeCommand(commandsDir, "notes.txt", "irrelevant");
    expect(discoverSlashCommands({ cwd: tmpDir })).toEqual([]);
  });
});

describe("SlashCommandRegistry", () => {
  const SAMPLE = [{ name: "review", description: "Reviews a diff.", template: "Review: $ARGUMENTS", path: ".codeagent/commands/review.md" }];

  it("list/get behave as expected", () => {
    const registry = new SlashCommandRegistry({ commands: SAMPLE });
    expect(registry.list()).toEqual(SAMPLE);
    expect(registry.get("review")).toEqual(SAMPLE[0]);
    expect(registry.get("nonexistent")).toBeNull();
  });
});
