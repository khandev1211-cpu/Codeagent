import { describe, it, expect } from "vitest";
import { skillInfo } from "../../src/tools/skillInfo.js";
import { SkillRegistry } from "../../src/skills/registry.js";

const SAMPLE_SKILLS = [
  { name: "commit-message", description: "Write a Conventional Commits message.", allowedTools: null, path: ".codeagent/skills/commit-message/SKILL.md" },
  { name: "code-review", description: "Review a diff for common issues.", allowedTools: null, path: ".codeagent/skills/code-review/SKILL.md" },
];

describe("skillInfo tool", () => {
  it("is non-destructive (no confirmation prompt required)", () => {
    expect(skillInfo.destructive).toBe(false);
  });

  it("returns description and path for known skill names", async () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const result = await skillInfo.execute({ names: ["commit-message"] }, { skillRegistry });
    expect(result.ok).toBe(true);
    expect(result.skills).toEqual([
      { name: "commit-message", found: true, description: "Write a Conventional Commits message.", path: ".codeagent/skills/commit-message/SKILL.md" },
    ]);
  });

  it("supports looking up multiple names in one call", async () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const result = await skillInfo.execute({ names: ["commit-message", "code-review"] }, { skillRegistry });
    expect(result.skills).toHaveLength(2);
    expect(result.skills.map((s) => s.name)).toEqual(["commit-message", "code-review"]);
  });

  it("reports found: false for unknown names rather than erroring", async () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const result = await skillInfo.execute({ names: ["nonexistent"] }, { skillRegistry });
    expect(result.ok).toBe(true);
    expect(result.skills).toEqual([{ name: "nonexistent", found: false }]);
  });

  it("returns an error when no skillRegistry is present in ctx", async () => {
    const result = await skillInfo.execute({ names: ["commit-message"] }, {});
    expect(result.ok).toBe(false);
  });

  it("returns an error when names is missing or empty", async () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const empty = await skillInfo.execute({ names: [] }, { skillRegistry });
    expect(empty.ok).toBe(false);
    const missing = await skillInfo.execute({}, { skillRegistry });
    expect(missing.ok).toBe(false);
  });
});
