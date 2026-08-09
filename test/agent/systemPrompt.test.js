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
