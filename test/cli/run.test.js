import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "../../src/cli/index.js";

/**
 * Regression coverage for a real bug found while building the interactive
 * config manager (docs/27): `shouldRunFirstTimeSetup()` decides "not
 * configured" from `configExists()`, which just checks for a `providers`
 * key — a corrupted `~/.codeagentrc` that happens to also be missing (or
 * has an invalid) `providers` key looked like "first run" too, and the
 * unguarded `loadConfig()` call inside that branch threw an uncaught
 * ConfigError with a raw stack trace instead of a friendly message,
 * before any command (including `config validate`, whose entire purpose
 * is handling exactly this) ever got a chance to run.
 */
describe("run() — corrupted config on what looks like first run", () => {
  let homedir;
  let exitSpy;

  afterEach(() => {
    if (homedir) fs.rmSync(homedir, { recursive: true, force: true });
    exitSpy?.mockRestore();
  });

  it("does not throw uncaught when the config file is invalid and configExists() also reports false", async () => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-run-"));
    // No `providers` key at all -> configExists() is false -> looks like
    // first run -> but the file DOES exist and IS invalid.
    fs.writeFileSync(path.join(homedir, ".codeagentrc"), JSON.stringify({ maxIterationsPerTurn: "not-a-number" }));

    const originalHomedir = os.homedir;
    os.homedir = () => homedir;
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

    try {
      await expect(run(["node", "codeagent", "config", "validate"])).resolves.not.toThrow();
    } finally {
      os.homedir = originalHomedir;
    }
  });
});
