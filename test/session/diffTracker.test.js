import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeFile } from "../../src/tools/writeFile.js";
import { DiffTracker } from "../../src/session/diffTracker.js";

describe("DiffTracker undo", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reverts an overwrite back to previous content", async () => {
    await fs.writeFile(path.join(tmpDir, "f.txt"), "original", "utf-8");
    const diffTracker = new DiffTracker({ cwd: tmpDir });
    await writeFile.execute(
      { path: "f.txt", content: "changed" },
      { cwd: tmpDir, allowedWritePaths: ["."], diffTracker }
    );

    await diffTracker.revert(diffTracker.mostRecent());
    const content = await fs.readFile(path.join(tmpDir, "f.txt"), "utf-8");
    expect(content).toBe("original");
  });

  it("reverts a newly created file by deleting it", async () => {
    const diffTracker = new DiffTracker({ cwd: tmpDir });
    await writeFile.execute(
      { path: "new.txt", content: "hi" },
      { cwd: tmpDir, allowedWritePaths: ["."], diffTracker }
    );
    await diffTracker.revert(diffTracker.mostRecent());
    await expect(fs.readFile(path.join(tmpDir, "new.txt"))).rejects.toThrow();
  });
});
