import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { SessionStore } from "../../src/session/store.js";

const BIN = path.resolve(import.meta.dirname, "../../bin/cli.js");

describe("khanagent rewind (real CLI)", () => {
  let home, project, env, store, original;

  const cli = (...args) => spawnSync("node", [BIN, ...args], { cwd: project, env, encoding: "utf-8", input: "", timeout: 30_000 });

  beforeAll(async () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-rw-home-"));
    project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-rw-proj-")));
    fs.writeFileSync(
      path.join(home, ".khanagentrc"),
      JSON.stringify({ provider: "ollama", model: "m", apiKeyEnvVar: "U", providers: { ollama: { apiKeyEnvVar: "U" } } })
    );
    env = { ...process.env, HOME: home, USERPROFILE: home };
    store = new SessionStore({ homedir: home, projectRoot: project });
    original = store.create({ provider: "ollama", model: "m" });
    original.messages = [
      { role: "user", content: "add a login page" },
      { role: "assistant", content: [{ type: "text", text: "done" }] },
      { role: "user", content: "now use redis for sessions" },
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "read_file", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
      { role: "assistant", content: [{ type: "text", text: "redis wired" }] },
      { role: "user", content: "actually revert that" },
      { role: "assistant", content: [{ type: "text", text: "reverted" }] },
    ];
    await store.save(original);
  });

  afterAll(() => {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  });

  it("--list shows real turns only, numbered", () => {
    const r = cli("rewind", "--list");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/1\s+add a login page/);
    expect(r.stdout).toMatch(/2\s+now use redis for sessions/);
    expect(r.stdout).toMatch(/3\s+actually revert that/);
    expect(r.stdout).not.toMatch(/\b4\s/); // the tool_result user message is not a turn
  });

  it("default drops the last turn into a NEW session and leaves the original untouched", async () => {
    const r = cli("rewind", "last", "--name", "before-revert");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("dropped 1 turn(s), kept 2");

    const rewound = await store.resolve("before-revert");
    expect(rewound.id).not.toBe(original.id);
    expect(rewound.forkedFrom).toBe(original.id);
    expect(rewound.messages).toHaveLength(6); // includes the whole tool round-trip
    expect(rewound.messages.at(-1).content[0].text).toBe("redis wired");
    expect((await store.load(original.id)).messages).toHaveLength(8);
  });

  it("--to keeps only the turns before turn N", async () => {
    const r = cli("rewind", original.id, "--to", "2", "--name", "just-login");
    expect(r.status).toBe(0);
    expect((await store.resolve("just-login")).messages).toHaveLength(2);
  });

  it("clear errors: conflicting flags, out of range, rewind-to-empty, unknown session, taken name", () => {
    expect(cli("rewind", original.id, "--to", "2", "--turns", "1").stderr).toMatch(/not both/);
    expect(cli("rewind", original.id, "--to", "9").stderr).toMatch(/between 1 and 3/);
    expect(cli("rewind", original.id, "--turns", "3").stderr).toMatch(/leave nothing/);
    expect(cli("rewind", original.id, "--to", "1").stderr).toMatch(/empty conversation/);
    expect(cli("rewind", "ghost").stderr).toMatch(/No session found/);
    const taken = cli("rewind", original.id, "--name", "just-login");
    expect(taken.status).toBe(1);
    expect(taken.stderr).toMatch(/already named/);
  });

  it("failed rewinds create no sessions", async () => {
    const before = (await store.list()).length;
    cli("rewind", original.id, "--to", "9");
    cli("rewind", original.id, "--name", "just-login");
    expect((await store.list()).length).toBe(before);
  });
});
