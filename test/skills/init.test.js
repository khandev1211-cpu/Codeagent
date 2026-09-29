import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { initSkills, BUNDLED_SKILLS_DIR } from "../../src/skills/init.js";
import { discoverSkills } from "../../src/skills/discover.js";

describe("initSkills", () => {
  let project;
  let source;

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-init-proj-"));
    source = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-init-src-"));
    for (const n of ["alpha", "beta"]) {
      fs.mkdirSync(path.join(source, n));
      fs.writeFileSync(path.join(source, n, "SKILL.md"), `---\nname: ${n}\ndescription: the ${n} skill\n---\nbody\n`);
    }
    fs.mkdirSync(path.join(source, "not-a-skill")); // no SKILL.md: ignored
  });

  afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  });

  it("copies every skill folder that has a SKILL.md, and ignores the rest", () => {
    const r = initSkills({ cwd: project, sourceDir: source });
    expect(r.copied).toEqual(["alpha", "beta"]);
    expect(r.skipped).toEqual([]);
    expect(fs.existsSync(path.join(project, ".khanagent/skills/not-a-skill"))).toBe(false);
    expect(discoverSkills({ cwd: project }).map((s) => s.name).sort()).toEqual(["alpha", "beta"]);
  });

  it("never overwrites an existing (customised) skill unless force is set", () => {
    initSkills({ cwd: project, sourceDir: source });
    const custom = path.join(project, ".khanagent/skills/alpha/SKILL.md");
    fs.writeFileSync(custom, "---\nname: alpha\ndescription: MINE\n---\n");

    const again = initSkills({ cwd: project, sourceDir: source });
    expect(again.copied).toEqual([]);
    expect(again.skipped).toEqual(["alpha", "beta"]);
    expect(fs.readFileSync(custom, "utf-8")).toContain("MINE");

    const forced = initSkills({ cwd: project, sourceDir: source, force: true });
    expect(forced.copied).toEqual(["alpha", "beta"]);
    expect(fs.readFileSync(custom, "utf-8")).toContain("the alpha skill");
  });

  it("throws a clear error when the source directory is missing", () => {
    expect(() => initSkills({ cwd: project, sourceDir: path.join(source, "nope") })).toThrow(/No bundled skills/);
  });

  it("the real bundled skills directory exists and every skill in it is discoverable", () => {
    const r = initSkills({ cwd: project });
    expect(r.copied.length).toBeGreaterThanOrEqual(100);
    const warnings = [];
    const found = discoverSkills({ cwd: project, logger: { warn: (m) => warnings.push(m) } });
    expect(warnings).toEqual([]);
    expect(found).toHaveLength(r.copied.length);
    expect(BUNDLED_SKILLS_DIR.endsWith(path.join(".khanagent", "skills"))).toBe(true);
  });

  it("`khanagent init-skills` works end to end through the real CLI", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-init-home-"));
    try {
      // A configured provider is needed, otherwise the first-run setup wizard opens.
      fs.writeFileSync(
        path.join(home, ".khanagentrc"),
        JSON.stringify({ provider: "ollama", model: "fake", apiKeyEnvVar: "UNUSED", providers: { ollama: { apiKeyEnvVar: "UNUSED" } } })
      );
      const bin = path.resolve(import.meta.dirname, "../../bin/cli.js");
      const env = { ...process.env, HOME: home, USERPROFILE: home };
      const out = execFileSync("node", [bin, "--trust", "init-skills"], { cwd: project, env, encoding: "utf-8" });
      expect(out).toMatch(/Installed \d+ skill/);
      const listed = execFileSync("node", [bin, "skills"], { cwd: project, env, encoding: "utf-8" });
      expect(listed).toContain("code-review");
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
