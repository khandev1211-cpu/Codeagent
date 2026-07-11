import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../../src/config/loader.js";
import { ConfigError } from "../../src/utils/errors.js";

describe("loadConfig layering", () => {
  let tmpHome, tmpCwd;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-home-"));
    tmpCwd = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-cwd-"));
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
    await fs.rm(tmpCwd, { recursive: true, force: true });
  });

  it("falls back to built-in defaults with no config files", () => {
    const config = loadConfig({}, { cwd: tmpCwd, homedir: tmpHome });
    expect(config.provider).toBe("anthropic");
    expect(config.maxIterationsPerTurn).toBe(25);
  });

  it("project config overrides global config", async () => {
    await fs.writeFile(path.join(tmpHome, ".codeagentrc"), JSON.stringify({ maxIterationsPerTurn: 10 }));
    await fs.mkdir(path.join(tmpCwd, ".codeagent"));
    await fs.writeFile(
      path.join(tmpCwd, ".codeagent", "config.json"),
      JSON.stringify({ maxIterationsPerTurn: 40 })
    );
    const config = loadConfig({}, { cwd: tmpCwd, homedir: tmpHome });
    expect(config.maxIterationsPerTurn).toBe(40);
  });

  it("CLI flags override everything", async () => {
    await fs.mkdir(path.join(tmpCwd, ".codeagent"));
    await fs.writeFile(
      path.join(tmpCwd, ".codeagent", "config.json"),
      JSON.stringify({ yolo: false })
    );
    const config = loadConfig({ yolo: true }, { cwd: tmpCwd, homedir: tmpHome });
    expect(config.yolo).toBe(true);
  });

  it("throws ConfigError on invalid values", () => {
    expect(() =>
      loadConfig({ maxIterationsPerTurn: -5 }, { cwd: tmpCwd, homedir: tmpHome })
    ).toThrow(ConfigError);
  });

  it("seeds provider-specific defaults when switching provider", () => {
    const config = loadConfig({ provider: "openrouter" }, { cwd: tmpCwd, homedir: tmpHome });
    expect(config.apiKeyEnvVar).toBe("OPENROUTER_API_KEY");
  });

  it.each([
    ["mistral", "MISTRAL_API_KEY"],
    ["groq", "GROQ_API_KEY"],
    ["cerebras", "CEREBRAS_API_KEY"],
    ["ollama", "OLLAMA_API_KEY"],
  ])("seeds correct default env var for provider %s", (provider, expectedEnvVar) => {
    const config = loadConfig({ provider }, { cwd: tmpCwd, homedir: tmpHome });
    expect(config.apiKeyEnvVar).toBe(expectedEnvVar);
  });
});