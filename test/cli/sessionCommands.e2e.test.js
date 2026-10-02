import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { SessionStore } from "../../src/session/store.js";

const BIN = path.resolve(import.meta.dirname, "../../bin/cli.js");

describe("session commands (real CLI)", () => {
  let home, project, env, original;

  const cli = (...args) =>
    spawnSync("node", [BIN, ...args], { cwd: project, env, encoding: "utf-8", input: "" , timeout: 30_000 });

  beforeAll(async () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-sc-home-"));
    project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-sc-proj-")));
    fs.writeFileSync(
      path.join(home, ".khanagentrc"),
      JSON.stringify({ provider: "ollama", model: "m", apiKeyEnvVar: "U", providers: { ollama: { apiKeyEnvVar: "U" } } })
    );
    env = { ...process.env, HOME: home, USERPROFILE: home, KHANAGENT_PLAIN_REPL: "1" };
    const store = new SessionStore({ homedir: home, projectRoot: project });
    original = store.create({ provider: "ollama", model: "m" });
    original.messages = [{ role: "user", content: "hi" }];
    await store.save(original);
  });

  afterAll(() => {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  });

  it("rename-session, then sessions shows the name", () => {
    const r = cli("rename-session", "last", "auth work");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('named "auth work"');
    expect(cli("sessions").stdout).toContain('"auth work"');
  });

  it("fork copies the latest session and sessions marks it as a fork", () => {
    const r = cli("fork", "auth work", "--name", "try-redis");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Forked [0-9a-f]{12} \(1 messages\)/);
    const listing = cli("sessions").stdout;
    expect(listing).toContain('"try-redis"');
    expect(listing).toContain(`[fork of ${original.id}]`);
  });

  it("works without folder trust (it never touches the project)", () => {
    // no --trust flag was passed to any call above, and the project is untrusted
    expect(cli("sessions").status).toBe(0);
  });

  it("gives clear errors for unknown sessions and duplicate/reserved names", () => {
    const missing = cli("rename-session", "ghost", "x");
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/No session found/);

    const dup = cli("rename-session", "try-redis", "auth work");
    expect(dup.status).toBe(1);
    expect(dup.stderr).toMatch(/already named/);

    expect(cli("rename-session", "last", "last").stderr).toMatch(/reserved/);
  });

  it("--resume accepts a name; an unknown name fails cleanly", () => {
    const ok = cli("--trust", "--resume", "auth work");
    expect(ok.stderr).not.toMatch(/No session found/);
    const bad = cli("--trust", "--resume", "nonexistent");
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/No session found with id or name "nonexistent"/);
  });
});
