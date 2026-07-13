import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KeychainManager } from "../../src/utils/keychain.js";

const TEST_PROVIDER = "codeagent-keychain-test-provider";

function keysFilePath() {
  return path.join(os.homedir(), ".codeagent", ".keys.json");
}

describe("KeychainManager", () => {
  const manager = new KeychainManager({ logger: { warn: () => {}, debug: () => {} } });

  afterEach(async () => {
    await manager.deleteKey(TEST_PROVIDER);
  });

  it("round-trips a normal key through save/get", async () => {
    await manager.saveKey(TEST_PROVIDER, "sk-test-1234567890");
    const key = await manager.getKey(TEST_PROVIDER);
    expect(key).toBe("sk-test-1234567890");
  });

  it("returns null for a provider that was never saved", async () => {
    const key = await manager.getKey("codeagent-never-configured-provider");
    expect(key).toBeNull();
  });

  it("delete removes a previously saved key", async () => {
    await manager.saveKey(TEST_PROVIDER, "sk-to-delete");
    await manager.deleteKey(TEST_PROVIDER);
    const key = await manager.getKey(TEST_PROVIDER);
    expect(key).toBeNull();
  });

  // Regression coverage for a real shell-injection risk: the original
  // implementation interpolated the raw key into shell command strings
  // (`security add-generic-password ... -w "${key}"`, `echo "${key}" |
  // pass insert ...`). A key containing quotes, backticks, `$()`, or `;`
  // could have broken out of the string and run arbitrary commands. The
  // fix uses execFileSync with argument arrays / stdin — these keys must
  // round-trip exactly, byte for byte, with no shell interpretation.
  it.each([
    ['key with "double quotes" inside', 'sk-"quoted"-value'],
    ["key with 'single quotes' inside", "sk-'quoted'-value"],
    ["key with a semicolon", "sk-abc;rm -rf /tmp/should-not-run"],
    ["key with backticks", "sk-`whoami`-value"],
    ["key with a dollar-paren substitution", "sk-$(whoami)-value"],
    ["key with a trailing pipe", "sk-value | cat /etc/passwd"],
    ["key with a newline", "sk-line1\nline2"],
  ])("round-trips a key containing shell metacharacters: %s", async (_label, weirdKey) => {
    await manager.saveKey(TEST_PROVIDER, weirdKey);
    const key = await manager.getKey(TEST_PROVIDER);
    expect(key).toBe(weirdKey);
  });

  it("local fallback storage file is permission-restricted", async () => {
    await manager.saveKey(TEST_PROVIDER, "sk-perm-check");
    const filePath = keysFilePath();
    if (fs.existsSync(filePath)) {
      const mode = fs.statSync(filePath).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });
});

// The tests above exercise KeychainManager's public API, but on a machine
// with none of `pass`/`security`/`cmdkey` installed (this sandbox has none
// of them), every save/get silently falls through to the always-safe local
// JSON file — meaning the actual previously-vulnerable code paths
// (_saveKeyLinux/_saveKeyMacOS/_saveKeyWindows) never really ran. These
// tests mock execFileSync directly to prove the *call shape* itself is
// injection-safe — the key is always a separate argv element or piped via
// `input`, never concatenated into a command string — independent of what
// happens to be installed wherever this runs.
describe("KeychainManager shell-injection fix (call-shape verification)", () => {
  const dangerousKey = 'sk-"; rm -rf / #';

  it("_saveKeyMacOS passes the key as a distinct argv element, never in a command string", async () => {
    vi.resetModules();
    vi.doMock("child_process", () => ({
      execFileSync: vi.fn((file, args) => {
        // Every arg must be its own array element. If the implementation
        // regressed to string interpolation, `dangerousKey`'s shell
        // metacharacters would show up *concatenated into* some other
        // argument rather than as their own clean element.
        for (const arg of args) {
          if (arg !== dangerousKey) {
            expect(arg.includes(dangerousKey)).toBe(false);
          }
        }
        if (args.includes("find-generic-password")) return "";
        return "";
      }),
    }));
    const { KeychainManager: MockedKeychainManager } = await import("../../src/utils/keychain.js");
    const testManager = new MockedKeychainManager({ logger: { warn: () => {}, debug: () => {} } });
    testManager.platform = "darwin";
    await expect(testManager.saveKey(TEST_PROVIDER, dangerousKey)).resolves.toBe(true);
    vi.doUnmock("child_process");
    vi.resetModules();
  });

  it("_saveKeyLinux pipes the key via stdin (input option), never via a shell string", async () => {
    vi.resetModules();
    const calls = [];
    vi.doMock("child_process", () => ({
      execFileSync: vi.fn((file, args, opts) => {
        calls.push({ file, args, opts });
        if (file === "which") return "";
        if (file === "pass" && args[0] === "insert") {
          // The key must never appear inside `args` (which would mean it
          // was interpolated into the command) — it must only appear via
          // opts.input, which execFileSync writes to stdin with no shell
          // involved at all.
          expect(args.join(" ")).not.toContain(dangerousKey);
          expect(opts.input).toBe(dangerousKey);
          return "";
        }
        return "";
      }),
    }));
    const { KeychainManager: MockedKeychainManager } = await import("../../src/utils/keychain.js");
    const testManager = new MockedKeychainManager({ logger: { warn: () => {}, debug: () => {} } });
    testManager.platform = "linux";
    await testManager.saveKey(TEST_PROVIDER, dangerousKey);
    const insertCall = calls.find((c) => c.file === "pass" && c.args[0] === "insert");
    expect(insertCall).toBeTruthy();
    expect(insertCall.opts.input).toBe(dangerousKey);
    vi.doUnmock("child_process");
    vi.resetModules();
  });
});
