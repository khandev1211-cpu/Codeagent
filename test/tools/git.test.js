import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { gitStatus, gitDiff } from "../../src/tools/git.js";

function git(cwd, ...args) {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, stdio: "pipe" });
}

describe("git tools", () => {
  let dir;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "khanagent-git-"));
    git(dir, "init", "-q");
    await fs.writeFile(path.join(dir, "a.txt"), "one\n");
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "init");
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("git_status reports a clean tree", async () => {
    const r = await gitStatus.execute({}, { cwd: dir });
    expect(r.ok).toBe(true);
    expect(r.clean).toBe(true);
    expect(r.branch).toBeTruthy();
  });

  it("git_status lists modified and untracked files", async () => {
    await fs.writeFile(path.join(dir, "a.txt"), "two\n");
    await fs.writeFile(path.join(dir, "new.txt"), "x\n");
    const r = await gitStatus.execute({}, { cwd: dir });
    expect(r.clean).toBe(false);
    expect(r.files).toContain("a.txt");
    expect(r.files).toContain("?? new.txt");
  });

  it("git_diff shows unstaged changes, then staged ones", async () => {
    await fs.writeFile(path.join(dir, "a.txt"), "two\n");
    const unstaged = await gitDiff.execute({}, { cwd: dir });
    expect(unstaged.diff).toContain("+two");
    expect((await gitDiff.execute({ staged: true }, { cwd: dir })).diff).toBe("(no changes)");
    git(dir, "add", "a.txt");
    expect((await gitDiff.execute({ staged: true }, { cwd: dir })).diff).toContain("+two");
  });

  it("git_diff accepts a ref and a path", async () => {
    await fs.writeFile(path.join(dir, "a.txt"), "two\n");
    git(dir, "commit", "-qam", "second");
    const r = await gitDiff.execute({ ref: "HEAD~1", path: "a.txt" }, { cwd: dir });
    expect(r.ok).toBe(true);
    expect(r.diff).toContain("-one");
  });

  it("rejects option-looking refs so --output cannot write files", async () => {
    const target = path.join(dir, "pwned.txt");
    const r = await gitDiff.execute({ ref: `--output=${target}` }, { cwd: dir });
    expect(r.ok).toBe(false);
    await expect(fs.access(target)).rejects.toThrow();
  });

  it("rejects refs with shell-ish characters and paths outside the project", async () => {
    expect((await gitDiff.execute({ ref: "HEAD; rm -rf /" }, { cwd: dir })).ok).toBe(false);
    expect((await gitDiff.execute({ path: "../../etc" }, { cwd: dir })).ok).toBe(false);
  });

  it("reports a clear error outside a git repository", async () => {
    const plain = await fs.mkdtemp(path.join(os.tmpdir(), "khanagent-nogit-"));
    try {
      const r = await gitStatus.execute({}, { cwd: plain });
      expect(r).toEqual({ ok: false, error: "Not a git repository" });
    } finally {
      await fs.rm(plain, { recursive: true, force: true });
    }
  });

  it("both tools are non-destructive", () => {
    expect(gitStatus.destructive).toBe(false);
    expect(gitDiff.destructive).toBe(false);
  });
});
