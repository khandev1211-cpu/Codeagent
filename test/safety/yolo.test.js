import { describe, it, expect } from "vitest";
import { shouldBypassConfirmation, describeUnsandboxedBypass } from "../../src/safety/yolo.js";

describe("shouldBypassConfirmation", () => {
  it("returns true when config.yolo is set", () => {
    expect(shouldBypassConfirmation({ yolo: true })).toBe(true);
  });

  it("returns true when config.autonomousMode is set, even without yolo (docs/31 — reuses the same bypass path)", () => {
    expect(shouldBypassConfirmation({ autonomousMode: true })).toBe(true);
  });

  it("returns true when both are set", () => {
    expect(shouldBypassConfirmation({ yolo: true, autonomousMode: true })).toBe(true);
  });

  it("returns false when neither is set", () => {
    expect(shouldBypassConfirmation({})).toBe(false);
  });

  it("returns false for a falsy autonomousMode value alongside a falsy yolo", () => {
    expect(shouldBypassConfirmation({ yolo: false, autonomousMode: false })).toBe(false);
  });
});

describe("describeUnsandboxedBypass", () => {
  it("warns on Windows when --yolo is active, since there is no run_bash sandbox there", () => {
    const msg = describeUnsandboxedBypass({ yolo: true }, { sandboxKind: "none", platform: "win32" });
    expect(msg).toMatch(/--yolo skips confirmation/);
    expect(msg).toMatch(/no run_bash sandbox on Windows/);
    expect(msg).toMatch(/version control/);
  });

  it("names Autonomous Mode when that is what enabled the bypass", () => {
    const msg = describeUnsandboxedBypass({ yolo: true, autonomousMode: true }, { sandboxKind: "none", platform: "win32" });
    expect(msg).toMatch(/Autonomous Mode skips confirmation/);
  });

  it("is silent when a sandbox is active, on any platform", () => {
    expect(describeUnsandboxedBypass({ yolo: true }, { sandboxKind: "bubblewrap", platform: "linux" })).toBeNull();
    expect(describeUnsandboxedBypass({ autonomousMode: true }, { sandboxKind: "sandbox-exec", platform: "darwin" })).toBeNull();
  });

  it("is silent when confirmation is NOT being skipped, even with no sandbox (the prompt is the guard)", () => {
    expect(describeUnsandboxedBypass({}, { sandboxKind: "none", platform: "win32" })).toBeNull();
    expect(describeUnsandboxedBypass({ yolo: false, autonomousMode: false }, { sandboxKind: "none", platform: "win32" })).toBeNull();
  });

  it("warns on Linux without bubblewrap, naming the platform", () => {
    expect(describeUnsandboxedBypass({ yolo: true }, { sandboxKind: "none", platform: "linux" })).toMatch(/no run_bash sandbox on Linux/);
  });

  it("warns when the user turned the sandbox off themselves, even though one is available", () => {
    const msg = describeUnsandboxedBypass({ yolo: true, sandboxMode: "off" }, { sandboxKind: "bubblewrap", platform: "linux" });
    expect(msg).toMatch(/sandboxMode is set to off/);
  });
});
