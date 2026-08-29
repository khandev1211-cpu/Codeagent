import { describe, it, expect } from "vitest";
import { THEMES, getTheme } from "../../../src/cli/tui/theme.js";

describe("getTheme", () => {
  it("returns the default theme when no name is given", () => {
    expect(getTheme(undefined)).toBe(THEMES.default);
  });

  it("returns the named theme when it exists", () => {
    expect(getTheme("monochrome")).toBe(THEMES.monochrome);
    expect(getTheme("high-contrast")).toBe(THEMES["high-contrast"]);
  });

  it("falls back to default for an unknown theme name rather than throwing", () => {
    expect(getTheme("nonexistent")).toBe(THEMES.default);
  });

  it("every theme defines the same set of semantic color keys", () => {
    const keys = Object.keys(THEMES.default).sort();
    for (const [name, theme] of Object.entries(THEMES)) {
      expect(Object.keys(theme).sort(), `theme "${name}" is missing a key`).toEqual(keys);
    }
  });
});
