import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const BIN_PATH = path.join(REPO_ROOT, "bin", "cli.js");
const { version: EXPECTED_VERSION } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));

/**
 * Regression coverage for a real bug found during a fresh-eyes dogfooding
 * pass against the actual published npm package (docs/14): `program
 * .version(...)` was never called in `src/cli/index.js`, so neither
 * `--version` nor `-V` worked at all (`error: unknown option`) — a
 * published CLI tool with no way to check which version is installed.
 * Runs the real `bin/cli.js` as a subprocess (not an internal function
 * call) specifically because that's the exact invocation surface the bug
 * was found on — an internal unit test of some helper function wouldn't
 * have caught commander's own flag registration being missing.
 */
describe("khanagent --version / -V (real subprocess invocation of bin/cli.js)", () => {
  it("--version prints the version from package.json", () => {
    const output = execFileSync("node", [BIN_PATH, "--version"], { encoding: "utf-8" }).trim();
    expect(output).toBe(EXPECTED_VERSION);
  });

  it("-V (shorthand) prints the same version", () => {
    const output = execFileSync("node", [BIN_PATH, "-V"], { encoding: "utf-8" }).trim();
    expect(output).toBe(EXPECTED_VERSION);
  });

  it("the printed version is a real semver string, not a placeholder", () => {
    const output = execFileSync("node", [BIN_PATH, "--version"], { encoding: "utf-8" }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("--help still works alongside --version (no flag-registration conflict)", () => {
    const output = execFileSync("node", [BIN_PATH, "--help"], { encoding: "utf-8" });
    expect(output).toContain("Usage: khanagent");
  });
}, 15_000);
