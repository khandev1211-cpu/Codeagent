import { describe, it, expect } from "vitest";
import { wireSkillsIndex } from "../../src/skills/index.js";
import { SkillRegistry } from "../../src/skills/registry.js";
import { ToolRegistry } from "../../src/tools/registry.js";

const SAMPLE_SKILLS = [
  { name: "commit-message", description: "Write a Conventional Commits message.", allowedTools: null, path: ".codeagent/skills/commit-message/SKILL.md" },
];

describe("wireSkillsIndex", () => {
  it("defaults to compact mode when config.skillsIndexMode is unset", () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const toolRegistry = new ToolRegistry([]);
    const { skillsIndex, skillsIndexMode } = wireSkillsIndex({ skillRegistry, toolRegistry, config: {} });
    expect(skillsIndexMode).toBe("compact");
    expect(skillsIndex).toBe("commit-message");
  });

  it("registers skill_info on the tool registry in compact mode when skills exist", () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const toolRegistry = new ToolRegistry([]);
    wireSkillsIndex({ skillRegistry, toolRegistry, config: { skillsIndexMode: "compact" } });
    expect(toolRegistry.has("skill_info")).toBe(true);
  });

  it("does not register skill_info when there are no skills, even in compact mode", () => {
    const skillRegistry = new SkillRegistry({ skills: [] });
    const toolRegistry = new ToolRegistry([]);
    wireSkillsIndex({ skillRegistry, toolRegistry, config: { skillsIndexMode: "compact" } });
    expect(toolRegistry.has("skill_info")).toBe(false);
  });

  it("does not register skill_info in full mode", () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const toolRegistry = new ToolRegistry([]);
    const { skillsIndex, skillsIndexMode } = wireSkillsIndex({ skillRegistry, toolRegistry, config: { skillsIndexMode: "full" } });
    expect(skillsIndexMode).toBe("full");
    expect(toolRegistry.has("skill_info")).toBe(false);
    expect(skillsIndex).toContain("Write a Conventional Commits message.");
  });

  it("is idempotent — calling it twice does not double-register or throw", () => {
    const skillRegistry = new SkillRegistry({ skills: SAMPLE_SKILLS });
    const toolRegistry = new ToolRegistry([]);
    wireSkillsIndex({ skillRegistry, toolRegistry, config: { skillsIndexMode: "compact" } });
    expect(() => wireSkillsIndex({ skillRegistry, toolRegistry, config: { skillsIndexMode: "compact" } })).not.toThrow();
    expect(toolRegistry.list().filter((t) => t.name === "skill_info")).toHaveLength(1);
  });
});
