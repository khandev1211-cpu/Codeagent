import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../../src/skills/frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses a well-formed frontmatter block and separates the body", () => {
    const raw = [
      "---",
      "name: commit-message",
      "description: Write a Conventional Commits style message.",
      "allowed-tools: run_bash",
      "---",
      "",
      "# Commit Message Skill",
      "",
      "Do the thing.",
    ].join("\n");

    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({
      name: "commit-message",
      description: "Write a Conventional Commits style message.",
      "allowed-tools": "run_bash",
    });
    expect(body).toBe("# Commit Message Skill\n\nDo the thing.");
  });

  it("throws when the file does not open with ---", () => {
    expect(() => parseFrontmatter("name: x\n---\nbody")).toThrow(/must start with/);
  });

  it("throws when the frontmatter block has no closing ---", () => {
    expect(() => parseFrontmatter("---\nname: x\nbody with no close")).toThrow(/closing ---/);
  });

  it("throws on a malformed line with no colon", () => {
    expect(() => parseFrontmatter("---\nname x\n---\nbody")).toThrow(/Malformed frontmatter line/);
  });

  it("ignores blank lines within the frontmatter block", () => {
    const raw = "---\nname: x\n\ndescription: y\n---\nbody";
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({ name: "x", description: "y" });
  });

  it("only splits on the first colon, so a description containing a colon survives intact", () => {
    const raw = "---\nname: x\ndescription: Use when: the user asks for X.\n---\nbody";
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.description).toBe("Use when: the user asks for X.");
  });

  it("handles CRLF line endings the same as LF", () => {
    const raw = "---\r\nname: x\r\ndescription: y\r\n---\r\nbody line";
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({ name: "x", description: "y" });
    expect(body).toBe("body line");
  });

  it("returns an empty body when there is none after the closing ---", () => {
    const { body } = parseFrontmatter("---\nname: x\n---");
    expect(body).toBe("");
  });
});
