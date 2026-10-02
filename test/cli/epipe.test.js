import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { initSkills } from "../../src/skills/init.js";

const BIN = path.resolve(import.meta.dirname, "../../bin/cli.js");

/**
 * `khanagent skills | head` closes the pipe while khanagent is still
 * writing. Node then emits an 'error' event (EPIPE) on stdout; unhandled,
 * that printed a raw stack trace. Closing a pipe early is normal shell
 * behaviour, not an error worth reporting.
 */
describe("closed stdout pipe (EPIPE)", () => {
  it("exits quietly, with no stack trace, when the reader closes early", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-epipe-home-"));
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-epipe-proj-"));
    try {
      fs.writeFileSync(
        path.join(home, ".khanagentrc"),
        JSON.stringify({ provider: "ollama", model: "x", apiKeyEnvVar: "U", providers: { ollama: { apiKeyEnvVar: "U" } } })
      );
      initSkills({ cwd: project }); // ~100 skills -> plenty of output to write after the reader is gone
      const r = spawnSync("sh", ["-c", `node "${BIN}" skills | head -c 1 >/dev/null`], {
        cwd: project,
        env: { ...process.env, HOME: home, USERPROFILE: home },
        encoding: "utf-8",
      });
      expect(r.stderr).not.toMatch(/EPIPE|Unhandled 'error'|node:events/);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
});
