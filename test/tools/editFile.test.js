import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { editFile } from "../../src/tools/editFile.js";

describe("edit_file", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-test-"));
    await fs.writeFile(path.join(tmpDir, "a.txt"), "foo bar baz\nfoo again", "utf-8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("fails clearly when old_content is not found", async () => {
    const result = await editFile.execute(
      { path: "a.txt", old_content: "nope", new_content: "x" },
      { cwd: tmpDir, allowedWritePaths: ["."] }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("fails clearly when old_content matches multiple locations", async () => {
    const result = await editFile.execute(
      { path: "a.txt", old_content: "foo", new_content: "x" },
      { cwd: tmpDir, allowedWritePaths: ["."] }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/2 locations/);
  });

  it("performs a unique find-and-replace", async () => {
    const result = await editFile.execute(
      { path: "a.txt", old_content: "bar", new_content: "REPLACED" },
      { cwd: tmpDir, allowedWritePaths: ["."] }
    );
    expect(result.ok).toBe(true);
    const content = await fs.readFile(path.join(tmpDir, "a.txt"), "utf-8");
    expect(content).toContain("REPLACED");
  });
});
