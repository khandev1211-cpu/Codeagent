import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/agent/systemPrompt.js";

describe("buildSystemPrompt", () => {
  it("includes the base tool-use conventions with no other input", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toMatch(/terminal-native AI coding agent/);
    expect(prompt).toMatch(/edit_file for small, targeted changes/);
  });

  it("omits every optional section when not provided", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).not.toMatch(/Standing instructions/);
    expect(prompt).not.toMatch(/Project context/);
    expect(prompt).not.toMatch(/Current plan/);
    expect(prompt).not.toMatch(/Additional instructions/);
    expect(prompt).not.toMatch(/AGENTS\.md/);
  });

  it("includes memory content when provided, under an AGENTS.md-labeled section", () => {
    const prompt = buildSystemPrompt({ memory: "Use tabs, not spaces." });
    expect(prompt).toMatch(/AGENTS\.md/);
    expect(prompt).toContain("Use tabs, not spaces.");
  });

  it("places memory after the admin prompt but before the skills index", () => {
    const prompt = buildSystemPrompt({
      adminPrompt: "ADMIN_MARKER",
      memory: "MEMORY_MARKER",
      skillsIndex: "SKILLS_MARKER",
    });
    const adminIdx = prompt.indexOf("ADMIN_MARKER");
    const memoryIdx = prompt.indexOf("MEMORY_MARKER");
    const skillsIdx = prompt.indexOf("SKILLS_MARKER");
    expect(adminIdx).toBeLessThan(memoryIdx);
    expect(memoryIdx).toBeLessThan(skillsIdx);
  });

  it("places the admin prompt before project context and project-level addendum", () => {
    const prompt = buildSystemPrompt({
      adminPrompt: "Always write TypeScript, never JavaScript.",
      projectContext: { tree: "src/\n  index.js" },
      customAddendum: "This project uses tabs, not spaces.",
    });
    const adminIdx = prompt.indexOf("Always write TypeScript");
    const projectIdx = prompt.indexOf("Project context");
    const addendumIdx = prompt.indexOf("This project uses tabs");
    expect(adminIdx).toBeGreaterThan(-1);
    expect(adminIdx).toBeLessThan(projectIdx);
    expect(adminIdx).toBeLessThan(addendumIdx);
  });

  it("places the base tool-use conventions before the admin prompt (admin cannot displace the operational scaffolding)", () => {
    const prompt = buildSystemPrompt({ adminPrompt: "Be extremely terse." });
    const baseIdx = prompt.indexOf("terminal-native AI coding agent");
    const adminIdx = prompt.indexOf("Be extremely terse");
    expect(baseIdx).toBeGreaterThan(-1);
    expect(baseIdx).toBeLessThan(adminIdx);
  });

  it("frames the admin prompt as priority, and explicitly scopes that priority away from safety/hooks", () => {
    const prompt = buildSystemPrompt({ adminPrompt: "Prefer functional style." });
    expect(prompt).toMatch(/priority/i);
    // The framing must not claim the admin prompt overrides tool-use
    // conventions or safety — those are enforced in code, not prompt text,
    // and the prompt should not imply otherwise.
    expect(prompt).toMatch(/tool-use conventions/);
  });

  it("still supports a project-level customAddendum independent of the admin prompt", () => {
    const prompt = buildSystemPrompt({ customAddendum: "Use 2-space indentation." });
    expect(prompt).toMatch(/Additional instructions/);
    expect(prompt).toMatch(/Use 2-space indentation/);
  });

  it("keeps output deterministic for the same input", () => {
    const input = { adminPrompt: "A", projectContext: { tree: "B" }, plannerOutput: "C", customAddendum: "D" };
    expect(buildSystemPrompt(input)).toBe(buildSystemPrompt(input));
  });

  it("skillsIndexMode 'full' (or omitted) renders descriptions inline, as before", () => {
    const prompt = buildSystemPrompt({ skillsIndex: "- **commit-message**: Write a commit message." });
    expect(prompt).toMatch(/Write a commit message\./);
    expect(prompt).not.toMatch(/skill_info/);
  });

  it("skillsIndexMode 'compact' renders names only and tells the model to call skill_info for details", () => {
    const prompt = buildSystemPrompt({ skillsIndex: "commit-message, code-review", skillsIndexMode: "compact" });
    expect(prompt).toMatch(/commit-message, code-review/);
    expect(prompt).toMatch(/skill_info/);
    // The whole point: no inline descriptions in compact mode.
    expect(prompt).not.toMatch(/Write a Conventional Commits/);
  });

  it("compact mode is meaningfully cheaper than full mode at realistic skill-set sizes", () => {
    // A single skill's fixed compact-mode instructional overhead (telling
    // the model to call skill_info) can outweigh one description's worth
    // of savings — the real win only shows up at the scale this was built
    // for (docs/19 measured this at ~6,500 tokens/turn for 102 skills).
    // Twenty skills is enough to demonstrate the crossover without the
    // test itself hardcoding 102.
    const skillCount = 20;
    const fullIndex = Array.from(
      { length: skillCount },
      (_, i) => `- **skill-${i}**: A reasonably detailed description of what skill ${i} does and when to use it. (read \`.codeagent/skills/skill-${i}/SKILL.md\` for full instructions)`
    ).join("\n");
    const compactIndex = Array.from({ length: skillCount }, (_, i) => `skill-${i}`).join(", ");

    const fullPrompt = buildSystemPrompt({ skillsIndex: fullIndex, skillsIndexMode: "full" });
    const compactPrompt = buildSystemPrompt({ skillsIndex: compactIndex, skillsIndexMode: "compact" });
    expect(compactPrompt.length).toBeLessThan(fullPrompt.length);
  });

  it("includes the skills index, positioned after the admin prompt and before project context", () => {
    const prompt = buildSystemPrompt({
      adminPrompt: "Prefer TypeScript.",
      skillsIndex: "- **commit-message**: writes commit messages (read `x/SKILL.md`)",
      projectContext: { tree: "src/" },
    });
    const adminIdx = prompt.indexOf("Prefer TypeScript");
    const skillsIdx = prompt.indexOf("Available skills");
    const projectIdx = prompt.indexOf("Project context");
    expect(adminIdx).toBeLessThan(skillsIdx);
    expect(skillsIdx).toBeLessThan(projectIdx);
    expect(prompt).toContain("commit-message");
  });

  it("omits the skills section entirely when skillsIndex is null (no skills configured)", () => {
    const prompt = buildSystemPrompt({ skillsIndex: null });
    expect(prompt).not.toMatch(/Available skills/);
  });

  it("frames skills as read-on-demand, not something to read preemptively", () => {
    const prompt = buildSystemPrompt({ skillsIndex: "- **x**: y" });
    expect(prompt).toMatch(/only if it's actually relevant/);
  });
});
