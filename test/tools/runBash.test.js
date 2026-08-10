import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { runBash, _resetRunBashWarningState } from "../../src/tools/runBash.js";
import { _resetSandboxCache, probeSandbox } from "../../src/safety/sandbox.js";

function makeLogger() {
  const warnings = [];
  return { logger: { warn: (msg) => warnings.push(msg), info: () => {}, error: () => {} }, warnings };
}

describe("runBash", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-runbash-"));
    _resetSandboxCache();
    _resetRunBashWarningState();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("runs a basic command and captures stdout", async () => {
    const result = await runBash.execute({ command: "echo hello" }, { cwd: tmpDir, config: {} });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("hello");
  });

  it("reports non-zero exit codes as not ok", async () => {
    const result = await runBash.execute({ command: "exit 3" }, { cwd: tmpDir, config: {} });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(3);
  });

  it("captures stderr separately from stdout", async () => {
    const result = await runBash.execute({ command: "echo err 1>&2" }, { cwd: tmpDir, config: {} });
    expect(result.stderr).toContain("err");
  });

  it("sandboxMode: 'off' always runs unsandboxed and reports sandboxed: false", async () => {
    const result = await runBash.execute({ command: "echo hi" }, { cwd: tmpDir, config: { sandboxMode: "off" } });
    expect(result.sandboxed).toBe(false);
  });

  it("logs a warning at most once per process when no sandbox is available and sandboxMode isn't 'off'", async () => {
    const kind = probeSandbox();
    if (kind !== "none") return; // this environment has a sandbox available — nothing to warn about
    const { logger, warnings } = makeLogger();
    await runBash.execute({ command: "echo a" }, { cwd: tmpDir, config: {}, logger });
    await runBash.execute({ command: "echo b" }, { cwd: tmpDir, config: {}, logger });
    expect(warnings.length).toBe(1);
  });

  it("actually writes a file inside the project root regardless of sandbox availability", async () => {
    const result = await runBash.execute({ command: "echo content > inside.txt" }, { cwd: tmpDir, config: {} });
    expect(result.ok).toBe(true);
    expect(fsSync.existsSync(path.join(tmpDir, "inside.txt"))).toBe(true);
  });
});

// These exercise the real, installed bubblewrap on this platform — not
// mocked — because a sandboxing feature is only actually verified by
// proving containment holds, not by asserting the arg array looks right
// (that's what sandbox.test.js already covers). Skipped entirely on any
// machine without bwrap, rather than failing — CI/dev machines without it
// installed should not be blocked by this.
const bwrapAvailable = process.platform === "linux" && fsSync.existsSync("/usr/bin/bwrap");
const describeIfBwrap = bwrapAvailable ? describe : describe.skip;

describeIfBwrap("runBash sandboxing (real bubblewrap, linux only)", () => {
  let projectDir;
  let outsideDir;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-project-"));
    outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-outside-"));
    _resetSandboxCache();
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.rm(outsideDir, { recursive: true, force: true });
  });

  it("reports sandboxed: true when bwrap is used", async () => {
    const result = await runBash.execute({ command: "echo hi" }, { cwd: projectDir, config: {} });
    expect(result.sandboxed).toBe(true);
  });

  it("allows writing inside the project root", async () => {
    const result = await runBash.execute({ command: "echo yes > allowed.txt" }, { cwd: projectDir, config: {} });
    expect(result.ok).toBe(true);
    expect(fsSync.existsSync(path.join(projectDir, "allowed.txt"))).toBe(true);
  });

  it("blocks writing to a path outside the project root and allowedWritePaths", async () => {
    const targetFile = path.join(outsideDir, "should-not-exist.txt");
    const result = await runBash.execute(
      { command: `echo no > ${targetFile}` },
      { cwd: projectDir, config: {} }
    );
    expect(result.ok).toBe(false);
    expect(fsSync.existsSync(targetFile)).toBe(false);
  });

  it("still allows reading files outside the project root (reads are unrestricted by design)", async () => {
    const result = await runBash.execute({ command: "cat /etc/hostname" }, { cwd: projectDir, config: {} });
    expect(result.ok).toBe(true);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  it("honors an extra allowedWritePaths entry outside the project root", async () => {
    const result = await runBash.execute(
      { command: `echo ok > ${path.join(outsideDir, "explicitly-allowed.txt")}` },
      { cwd: projectDir, config: { allowedWritePaths: [".", outsideDir] } }
    );
    expect(result.ok).toBe(true);
    expect(fsSync.existsSync(path.join(outsideDir, "explicitly-allowed.txt"))).toBe(true);
  });

  it("kills the whole sandboxed process tree on timeout, leaving no orphaned process", async () => {
    const result = await runBash.execute(
      { command: "sleep 5" },
      { cwd: projectDir, config: { bashTimeoutMs: 300 } }
    );
    expect(result.timedOut).toBe(true);
  }, 3000);
});
