import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadConfig,
  saveGlobalConfig,
  configExists,
  upsertProvider,
  listConfiguredProviders,
} from "../../src/config/loader.js";
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

describe("global config persistence (docs/18)", () => {
  let tmpHome;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "codeagent-home-"));
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("configExists is false with no ~/.codeagentrc at all", () => {
    expect(configExists({ homedir: tmpHome })).toBe(false);
  });

  it("configExists is false for an empty or provider-less config file", async () => {
    await fs.writeFile(path.join(tmpHome, ".codeagentrc"), JSON.stringify({ logLevel: "debug" }));
    expect(configExists({ homedir: tmpHome })).toBe(false);
  });

  it("saveGlobalConfig writes a new file, and configExists becomes true after upsertProvider", () => {
    upsertProvider(
      { provider: "anthropic", apiKeyEnvVar: "ANTHROPIC_API_KEY", model: "claude-sonnet-5" },
      { homedir: tmpHome }
    );
    expect(configExists({ homedir: tmpHome })).toBe(true);
  });

  it("upsertProvider merges instead of overwriting previously configured providers", () => {
    upsertProvider(
      { provider: "anthropic", apiKeyEnvVar: "ANTHROPIC_API_KEY", model: "claude-sonnet-5" },
      { homedir: tmpHome }
    );
    upsertProvider(
      { provider: "mistral", apiKeyEnvVar: "MISTRAL_API_KEY", model: "codestral-latest" },
      { homedir: tmpHome, makeActive: false }
    );
    const configured = listConfiguredProviders({ homedir: tmpHome });
    expect(Object.keys(configured).sort()).toEqual(["anthropic", "mistral"]);
    // the second upsert had makeActive: false, so anthropic should still be active
    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.provider).toBe("anthropic");
  });

  it("upsertProvider with makeActive (default) switches the active provider/model", () => {
    upsertProvider(
      { provider: "anthropic", apiKeyEnvVar: "ANTHROPIC_API_KEY", model: "claude-sonnet-5" },
      { homedir: tmpHome }
    );
    upsertProvider(
      { provider: "mistral", apiKeyEnvVar: "MISTRAL_API_KEY", model: "codestral-latest" },
      { homedir: tmpHome }
    );
    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.provider).toBe("mistral");
    expect(resolved.model).toBe("codestral-latest");
    // the first provider is still remembered even though it is no longer active
    expect(Object.keys(listConfiguredProviders({ homedir: tmpHome })).sort()).toEqual([
      "anthropic",
      "mistral",
    ]);
  });

  it("saveGlobalConfig deep-merges adminSystemPrompt without touching providers", () => {
    upsertProvider(
      { provider: "anthropic", apiKeyEnvVar: "ANTHROPIC_API_KEY", model: "claude-sonnet-5" },
      { homedir: tmpHome }
    );
    saveGlobalConfig({ adminSystemPrompt: "Always write TypeScript." }, { homedir: tmpHome });
    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.adminSystemPrompt).toBe("Always write TypeScript.");
    expect(Object.keys(listConfiguredProviders({ homedir: tmpHome }))).toEqual(["anthropic"]);
  });

  it("loadConfig round-trips the providers map through ConfigSchema without stripping it", () => {
    upsertProvider(
      { provider: "anthropic", apiKeyEnvVar: "ANTHROPIC_API_KEY", model: "claude-sonnet-5", useKeychain: true },
      { homedir: tmpHome }
    );
    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.providers.anthropic).toEqual({
      apiKeyEnvVar: "ANTHROPIC_API_KEY",
      model: "claude-sonnet-5",
      useKeychain: true,
    });
  });
});