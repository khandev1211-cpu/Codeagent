import { describe, it, expect } from "vitest";
import { globMatch } from "../../src/safety/glob.js";

describe("globMatch", () => {
  it("matches an exact literal string with no wildcard", () => {
    expect(globMatch("npm test", "npm test")).toBe(true);
    expect(globMatch("npm test", "npm build")).toBe(false);
  });

  it("* matches any run of characters", () => {
    expect(globMatch("npm test*", "npm test")).toBe(true);
    expect(globMatch("npm test*", "npm test -- --watch")).toBe(true);
    expect(globMatch("npm test*", "npm build")).toBe(false);
  });

  it("* at the start matches a suffix pattern", () => {
    expect(globMatch("*.env", ".env")).toBe(true);
    expect(globMatch("*.env", "packages/api/.env")).toBe(true);
    expect(globMatch("*.env", ".env.example")).toBe(false);
  });

  it("* in the middle matches across the gap", () => {
    expect(globMatch("rm -rf*", "rm -rf /")).toBe(true);
    expect(globMatch("rm*-rf*", "rm -rf /tmp/x")).toBe(true);
  });

  it("escapes regex-special characters in the literal portion", () => {
    expect(globMatch("file (1).txt", "file (1).txt")).toBe(true);
    expect(globMatch("price$100", "price$100")).toBe(true);
    expect(globMatch("a.b", "aXb")).toBe(false); // literal dot, not regex "any char"
  });

  it("returns false for a non-string subject rather than throwing", () => {
    expect(globMatch("*", undefined)).toBe(false);
    expect(globMatch("*", null)).toBe(false);
    expect(globMatch("*", 42)).toBe(false);
  });

  it("bare * matches anything, including an empty string", () => {
    expect(globMatch("*", "")).toBe(true);
    expect(globMatch("*", "anything at all")).toBe(true);
  });
});
