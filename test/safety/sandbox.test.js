import { describe, it, expect } from "vitest";
import { decideSandboxKind, wrapWithSandbox, buildSandboxExecProfile, resolveWritablePaths } from "../../src/safety/sandbox.js";

describe("decideSandboxKind", () => {
  it("chooses bubblewrap on linux when bwrap is available", () => {
    expect(decideSandboxKind({ platform: "linux", bwrapAvailable: true, sandboxExecAvailable: false })).toBe("bubblewrap");
  });

  it("chooses sandbox-exec on darwin when available", () => {
    expect(decideSandboxKind({ platform: "darwin", bwrapAvailable: false, sandboxExecAvailable: true })).toBe("sandbox-exec");
  });

  it("falls back to none on linux without bwrap", () => {
    expect(decideSandboxKind({ platform: "linux", bwrapAvailable: false, sandboxExecAvailable: false })).toBe("none");
  });

  it("falls back to none on darwin without sandbox-exec", () => {
    expect(decideSandboxKind({ platform: "darwin", bwrapAvailable: false, sandboxExecAvailable: false })).toBe("none");
  });

  it("falls back to none on unsupported platforms (e.g. win32) regardless of flags", () => {
    expect(decideSandboxKind({ platform: "win32", bwrapAvailable: true, sandboxExecAvailable: true })).toBe("none");
  });
});

describe("wrapWithSandbox", () => {
  const base = { cmd: "/bin/sh", args: ["-c", "echo hi"], cwd: "/project", writablePaths: ["/project"] };

  it("kind 'none' passes the command through completely unchanged", () => {
    const result = wrapWithSandbox({ kind: "none", ...base });
    expect(result).toEqual({ cmd: "/bin/sh", args: ["-c", "echo hi"] });
  });

  it("kind 'bubblewrap' wraps in bwrap, mounts root read-only, and binds every writable path", () => {
    const result = wrapWithSandbox({ kind: "bubblewrap", ...base, writablePaths: ["/project", "/tmp/extra"] });
    expect(result.cmd).toBe("bwrap");
    expect(result.args).toContain("--ro-bind");
    expect(result.args).toContain("--unshare-pid");
    expect(result.args).toContain("--die-with-parent");
    // Both writable paths must be explicitly bound read-write.
    const bindIndices = result.args.reduce((acc, a, i) => (a === "--bind" ? [...acc, i] : acc), []);
    const boundPaths = bindIndices.map((i) => result.args[i + 1]);
    expect(boundPaths).toEqual(["/project", "/tmp/extra"]);
    // The original command must still be present, after the bwrap args.
    expect(result.args.slice(-3)).toEqual(["/bin/sh", "-c", "echo hi"]);
  });

  it("kind 'bubblewrap' passes --chdir with the working directory", () => {
    const result = wrapWithSandbox({ kind: "bubblewrap", ...base, cwd: "/some/project" });
    const chdirIdx = result.args.indexOf("--chdir");
    expect(chdirIdx).toBeGreaterThan(-1);
    expect(result.args[chdirIdx + 1]).toBe("/some/project");
  });

  it("kind 'sandbox-exec' wraps with -p and an SBPL profile allowing default but denying writes outside writablePaths", () => {
    const result = wrapWithSandbox({ kind: "sandbox-exec", ...base });
    expect(result.cmd).toBe("sandbox-exec");
    expect(result.args[0]).toBe("-p");
    expect(result.args[1]).toMatch(/deny file-write\*/);
    expect(result.args[1]).toContain('(subpath "/project")');
    // Original command preserved after the profile.
    expect(result.args.slice(2)).toEqual(["/bin/sh", "-c", "echo hi"]);
  });
});

describe("buildSandboxExecProfile", () => {
  it("allows default, denies all writes, then re-allows writes under each given subpath", () => {
    const profile = buildSandboxExecProfile(["/a", "/b"]);
    expect(profile).toMatch(/\(allow default\)/);
    expect(profile).toMatch(/\(deny file-write\*\)/);
    expect(profile).toContain('(subpath "/a")');
    expect(profile).toContain('(subpath "/b")');
  });
});

describe("resolveWritablePaths", () => {
  it("defaults to the project root only, matching pathGuard.js's default", () => {
    expect(resolveWritablePaths({ cwd: "/project" })).toEqual(["/project"]);
  });

  it("resolves each configured allowedWritePaths entry relative to cwd", () => {
    const result = resolveWritablePaths({ cwd: "/project", allowedWritePaths: [".", "../shared"] });
    expect(result).toEqual(["/project", "/shared"]);
  });
});
