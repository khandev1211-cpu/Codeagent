import { describe, it, expect } from "vitest";
import { SkillRegistry } from "../../src/skills/registry.js";

const SAMPLE_SKILLS = [
  { name: "commit-message", description: "Write a Conventional Commits message.", allowedTools: ["run_bash"], path: ".codeagent/skills/commit-message/SKILL.md" },
  { name: "code-review", description: "Review a diff for common issues.", allowedTools: null, path: ".codeagent/skills/code-review/SKILL.md" },
];

describe("SkillRegistry", () => {
  it("list() returns exactly what it was constructed with", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    expect(registry.list()).toEqual(SAMPLE_SKILLS);
  });

  it("has() and get() work by name", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    expect(registry.has("commit-message")).toBe(true);
    expect(registry.has("nonexistent")).toBe(false);
    expect(registry.get("code-review")).toEqual(SAMPLE_SKILLS[1]);
    expect(registry.get("nonexistent")).toBeNull();
  });

  it("formatIndexForPrompt returns null when there are no skills", () => {
    const registry = new SkillRegistry({ skills: [] });
    expect(registry.formatIndexForPrompt()).toBeNull();
  });

  it("formatIndexForPrompt includes name, description, and file path for every skill", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const index = registry.formatIndexForPrompt();
    expect(index).toContain("commit-message");
    expect(index).toContain("Write a Conventional Commits message.");
    expect(index).toContain(".codeagent/skills/commit-message/SKILL.md");
    expect(index).toContain("code-review");
  });

  it("constructing without an explicit skills array discovers from disk (falls back to discoverSkills)", () => {
    // No .codeagent/skills in the current working directory during tests
    // -> should resolve to an empty list without throwing.
    const registry = new SkillRegistry({ cwd: "/tmp/codeagent-nonexistent-skills-cwd" });
    expect(registry.list()).toEqual([]);
  });
});
