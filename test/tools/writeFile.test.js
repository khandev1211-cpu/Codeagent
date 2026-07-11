import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeFile } from "../../src/tools/writeFile.js";
import { DiffTracker } from "../../src/session/diffTracker.js";

describe("write_file", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a new file and records diff as not-existed", async () => {
    const diffTracker = new DiffTracker({ cwd: tmpDir });
    const result = await writeFile.execute(
      { path: "hello.txt", content: "hi there" },
      { cwd: tmpDir, allowedWritePaths: ["."], diffTracker }
    );
    expect(result.ok).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, "hello.txt"), "utf-8");
    expect(content).toBe("hi there");
    expect(diffTracker.list()).toHaveLength(1);
    expect(diffTracker.list()[0].existed).toBe(false);
  });

  it("overwrites an existing file and records previous content", async () => {
    await fs.writeFile(path.join(tmpDir, "hello.txt"), "old content", "utf-8");
    const diffTracker = new DiffTracker({ cwd: tmpDir });
    await writeFile.execute(
      { path: "hello.txt", content: "new content" },
      { cwd: tmpDir, allowedWritePaths: ["."], diffTracker }
    );
    const entry = diffTracker.mostRecent();
    expect(entry.existed).toBe(true);
    expect(entry.previousContent).toBe("old content");
  });

  it("refuses to write outside the project root", async () => {
    const result = await writeFile.execute(
      { path: "../escape.txt", content: "nope" },
      { cwd: tmpDir, allowedWritePaths: ["."] }
    );
    expect(result.ok).toBe(false);
  });

  it("creates parent directories as needed", async () => {
    const result = await writeFile.execute(
      { path: "nested/dir/file.txt", content: "x" },
      { cwd: tmpDir, allowedWritePaths: ["."] }
    );
    expect(result.ok).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, "nested/dir/file.txt"), "utf-8");
    expect(content).toBe("x");
  });
});
