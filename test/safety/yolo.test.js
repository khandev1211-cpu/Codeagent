import { describe, it, expect } from "vitest";
import { shouldBypassConfirmation } from "../../src/safety/yolo.js";

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
