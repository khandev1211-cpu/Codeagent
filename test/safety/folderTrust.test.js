import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveTrustKey,
  isFolderTrusted,
  trustFolder,
  revokeFolder,
  revokeAllFolders,
  listTrustedFolders,
  TRUST_EXEMPT_COMMANDS,
} from "../../src/safety/folderTrust.js";

describe("resolveTrustKey", () => {
  let realDir;
  let symlinkDir;
  let base;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-trust-realpath-"));
    realDir = path.join(base, "real-project");
    fs.mkdirSync(realDir);
    symlinkDir = path.join(base, "symlinked-project");
    fs.symlinkSync(realDir, symlinkDir);
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("resolves a symlink to its real target path", () => {
    expect(resolveTrustKey(symlinkDir)).toBe(fs.realpathSync(realDir));
  });

  it("a symlink and its real target resolve to the SAME trust key", () => {
    expect(resolveTrustKey(symlinkDir)).toBe(resolveTrustKey(realDir));
  });

  it("falls back to path.resolve for a path that doesn't exist, rather than throwing", () => {
    const nonexistent = path.join(base, "does-not-exist");
    expect(() => resolveTrustKey(nonexistent)).not.toThrow();
    expect(resolveTrustKey(nonexistent)).toBe(path.resolve(nonexistent));
  });
});

describe("Folder Trust registry (isFolderTrusted / trustFolder / revokeFolder / revokeAllFolders / listTrustedFolders)", () => {
  let homedir;
  let projectA;
  let projectB;

  beforeEach(() => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-trust-home-"));
    projectA = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-trust-project-a-"));
    projectB = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-trust-project-b-"));
  });

  afterEach(() => {
    fs.rmSync(homedir, { recursive: true, force: true });
    fs.rmSync(projectA, { recursive: true, force: true });
    fs.rmSync(projectB, { recursive: true, force: true });
  });

  it("a folder is untrusted by default", async () => {
    expect(await isFolderTrusted(projectA, { homedir })).toBe(false);
  });

  it("trustFolder makes isFolderTrusted return true for that folder", async () => {
    await trustFolder(projectA, { homedir });
    expect(await isFolderTrusted(projectA, { homedir })).toBe(true);
  });

  it("trusting one folder does not trust a different, unrelated folder", async () => {
    await trustFolder(projectA, { homedir });
    expect(await isFolderTrusted(projectB, { homedir })).toBe(false);
  });

  it("trusting a parent does not automatically trust a subdirectory (no inheritance, docs/30)", async () => {
    const subdir = path.join(projectA, "subproject");
    fs.mkdirSync(subdir);
    await trustFolder(projectA, { homedir });
    expect(await isFolderTrusted(subdir, { homedir })).toBe(false);
  });

  it("revokeFolder removes trust and returns true when the folder was trusted", async () => {
    await trustFolder(projectA, { homedir });
    const existed = await revokeFolder(projectA, { homedir });
    expect(existed).toBe(true);
    expect(await isFolderTrusted(projectA, { homedir })).toBe(false);
  });

  it("revokeFolder returns false when the folder wasn't trusted, without throwing", async () => {
    const existed = await revokeFolder(projectA, { homedir });
    expect(existed).toBe(false);
  });

  it("revokeAllFolders clears every trusted folder", async () => {
    await trustFolder(projectA, { homedir });
    await trustFolder(projectB, { homedir });
    await revokeAllFolders({ homedir });
    expect(await isFolderTrusted(projectA, { homedir })).toBe(false);
    expect(await isFolderTrusted(projectB, { homedir })).toBe(false);
  });

  it("listTrustedFolders returns every trusted folder with a trustedAt timestamp", async () => {
    await trustFolder(projectA, { homedir });
    await trustFolder(projectB, { homedir });
    const list = await listTrustedFolders({ homedir });
    expect(list).toHaveLength(2);
    expect(list.map((f) => f.path).sort()).toEqual([fs.realpathSync(projectA), fs.realpathSync(projectB)].sort());
    for (const entry of list) {
      expect(entry.trustedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("listTrustedFolders returns an empty array when nothing is trusted", async () => {
    expect(await listTrustedFolders({ homedir })).toEqual([]);
  });

  it("listTrustedFolders sorts most-recently-trusted first", async () => {
    await trustFolder(projectA, { homedir });
    await new Promise((r) => setTimeout(r, 5));
    await trustFolder(projectB, { homedir });
    const list = await listTrustedFolders({ homedir });
    expect(list[0].path).toBe(fs.realpathSync(projectB));
  });

  it("persists across independent calls (real file, not in-memory state)", async () => {
    await trustFolder(projectA, { homedir });
    // A fresh call with the same homedir, no shared object reference —
    // proves this reads from disk, not a module-level cache.
    expect(await isFolderTrusted(projectA, { homedir })).toBe(true);
  });

  it("does not crash when the registry file doesn't exist yet", async () => {
    await expect(isFolderTrusted(projectA, { homedir })).resolves.toBe(false);
    await expect(listTrustedFolders({ homedir })).resolves.toEqual([]);
  });
});

describe("TRUST_EXEMPT_COMMANDS", () => {
  it("includes every read-only discovery/listing command", () => {
    for (const cmd of ["skills", "subagents", "memory", "commands", "mcp", "hooks", "permissions", "sessions", "usage", "quota"]) {
      expect(TRUST_EXEMPT_COMMANDS.has(cmd)).toBe(true);
    }
  });

  it("includes commands that only touch global config, never the project", () => {
    for (const cmd of ["setup", "config", "providers", "use", "models", "mistral-models", "system-prompt"]) {
      expect(TRUST_EXEMPT_COMMANDS.has(cmd)).toBe(true);
    }
  });

  it("includes 'trust' itself, avoiding a chicken-and-egg gate on trust management", () => {
    expect(TRUST_EXEMPT_COMMANDS.has("trust")).toBe(true);
  });

  it("does NOT include 'undo' — it genuinely reverts project files, so it must be gated", () => {
    expect(TRUST_EXEMPT_COMMANDS.has("undo")).toBe(false);
  });
});
