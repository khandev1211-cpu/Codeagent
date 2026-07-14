import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverSkills } from "../../src/skills/discover.js";

function writeSkill(skillsDir, name, content) {
  const dir = path.join(skillsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), content);
}

const VALID_SKILL = [
  "---",
  "name: commit-message",
  "description: Write a Conventional Commits style commit message.",
  "allowed-tools: run_bash",
  "---",
  "",
  "Body instructions here.",
].join("\n");

describe("discoverSkills", () => {
  let tmpDir;
  let skillsDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-skills-test-"));
    skillsDir = path.join(tmpDir, ".codeagent", "skills");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty array when .codeagent/skills doesn't exist", () => {
    expect(discoverSkills({ cwd: tmpDir })).toEqual([]);
  });

  it("discovers a well-formed skill and returns index fields only", () => {
    writeSkill(skillsDir, "commit-message", VALID_SKILL);
    const skills = discoverSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]).toEqual({
      name: "commit-message",
      description: "Write a Conventional Commits style commit message.",
      allowedTools: ["run_bash"],
      path: ".codeagent/skills/commit-message/SKILL.md",
    });
  });

  it("does not include the skill body anywhere in the returned index (progressive disclosure)", () => {
    writeSkill(skillsDir, "commit-message", VALID_SKILL);
    const skills = discoverSkills({ cwd: tmpDir });
    const serialized = JSON.stringify(skills);
    expect(serialized).not.toContain("Body instructions here");
  });

  it("discovers multiple skills", () => {
    writeSkill(skillsDir, "commit-message", VALID_SKILL);
    writeSkill(
      skillsDir,
      "code-review",
      "---\nname: code-review\ndescription: Review a diff for common issues.\n---\nReview body."
    );
    const skills = discoverSkills({ cwd: tmpDir });
    expect(skills.map((s) => s.name).sort()).toEqual(["code-review", "commit-message"]);
  });

  it("allowedTools is null when the frontmatter omits allowed-tools", () => {
    writeSkill(skillsDir, "no-tools", "---\nname: no-tools\ndescription: A skill with no tool restriction.\n---\nBody.");
    const [skill] = discoverSkills({ cwd: tmpDir });
    expect(skill.allowedTools).toBeNull();
  });

  it("parses a comma-separated allowed-tools list, trimming whitespace", () => {
    writeSkill(
      skillsDir,
      "multi-tool",
      "---\nname: multi-tool\ndescription: Uses several tools.\nallowed-tools: read_file, write_file ,  run_bash\n---\nBody."
    );
    const [skill] = discoverSkills({ cwd: tmpDir });
    expect(skill.allowedTools).toEqual(["read_file", "write_file", "run_bash"]);
  });

  it("skips a skill folder with no SKILL.md, without throwing", () => {
    fs.mkdirSync(path.join(skillsDir, "empty-folder"), { recursive: true });
    const warnings = [];
    const skills = discoverSkills({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(skills).toEqual([]);
    expect(warnings[0]).toMatch(/no SKILL\.md/);
  });

  it("skips a skill with malformed frontmatter rather than throwing, and still discovers valid siblings", () => {
    writeSkill(skillsDir, "broken", "not even frontmatter");
    writeSkill(skillsDir, "commit-message", VALID_SKILL);
    const warnings = [];
    const skills = discoverSkills({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(skills.map((s) => s.name)).toEqual(["commit-message"]);
    expect(warnings.some((w) => w.includes("broken"))).toBe(true);
  });

  it("skips a skill missing a required field (description)", () => {
    writeSkill(skillsDir, "incomplete", "---\nname: incomplete\n---\nBody.");
    const warnings = [];
    const skills = discoverSkills({ cwd: tmpDir, logger: { warn: (m) => warnings.push(m) } });
    expect(skills).toEqual([]);
    expect(warnings[0]).toMatch(/missing required field.*description/);
  });

  it("never throws, even with a completely empty skills directory", () => {
    fs.mkdirSync(skillsDir, { recursive: true });
    expect(() => discoverSkills({ cwd: tmpDir })).not.toThrow();
    expect(discoverSkills({ cwd: tmpDir })).toEqual([]);
  });
});
