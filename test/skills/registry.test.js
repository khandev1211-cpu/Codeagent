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

  it("formatCompactIndexForPrompt returns null when there are no skills", () => {
    const registry = new SkillRegistry({ skills: [] });
    expect(registry.formatCompactIndexForPrompt()).toBeNull();
  });

  it("formatCompactIndexForPrompt returns only names, no descriptions or paths", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const compact = registry.formatCompactIndexForPrompt();
    expect(compact).toBe("commit-message, code-review");
    expect(compact).not.toContain("Write a Conventional Commits message.");
    expect(compact).not.toContain(".codeagent/skills");
  });

  it("formatCompactIndexForPrompt is substantially cheaper than the full index", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    expect(registry.formatCompactIndexForPrompt().length).toBeLessThan(registry.formatIndexForPrompt().length);
  });

  it("describe() returns description and path for known names", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    expect(registry.describe(["commit-message"])).toEqual([
      { name: "commit-message", found: true, description: "Write a Conventional Commits message.", path: ".codeagent/skills/commit-message/SKILL.md" },
    ]);
  });

  it("describe() reports found: false for unknown names without throwing", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    expect(registry.describe(["nonexistent"])).toEqual([{ name: "nonexistent", found: false }]);
  });

  it("describe() handles a mix of known and unknown names in one call", () => {
    const registry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const result = registry.describe(["commit-message", "nonexistent"]);
    expect(result[0].found).toBe(true);
    expect(result[1]).toEqual({ name: "nonexistent", found: false });
  });
});
