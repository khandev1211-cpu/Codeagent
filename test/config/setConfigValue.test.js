import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { coerceConfigValue, setConfigValue, INTERACTIVE_CONFIG_FIELDS } from "../../src/config/setConfigValue.js";
import { loadConfig } from "../../src/config/loader.js";

describe("coerceConfigValue", () => {
  it("coerces 'true'/'false' strings into booleans for boolean fields", () => {
    expect(coerceConfigValue("planMode", "true")).toBe(true);
    expect(coerceConfigValue("planMode", "false")).toBe(false);
  });

  it("is case-insensitive for boolean values", () => {
    expect(coerceConfigValue("yolo", "TRUE")).toBe(true);
    expect(coerceConfigValue("yolo", "False")).toBe(false);
  });

  it("rejects a non-boolean string for a boolean field", () => {
    expect(() => coerceConfigValue("planMode", "yes")).toThrow(/expects true or false/);
  });

  it("coerces numeric strings into numbers for number fields", () => {
    expect(coerceConfigValue("maxIterationsPerTurn", "10")).toBe(10);
  });

  it("rejects a non-numeric string for a number field", () => {
    expect(() => coerceConfigValue("maxIterationsPerTurn", "abc")).toThrow(/expects a number/);
  });

  it("rejects a number field's own validation (e.g. must be positive)", () => {
    expect(() => coerceConfigValue("maxIterationsPerTurn", "-5")).toThrow(/Invalid value/);
  });

  it("accepts a valid enum value", () => {
    expect(coerceConfigValue("skillsIndexMode", "full")).toBe("full");
  });

  it("rejects an invalid enum value with a message", () => {
    expect(() => coerceConfigValue("skillsIndexMode", "nonsense")).toThrow(/Invalid value/);
  });

  it("splits a comma-separated string into an array for array fields", () => {
    expect(coerceConfigValue("allowedWritePaths", "., ../shared,  ./tmp")).toEqual([".", "../shared", "./tmp"]);
  });

  it("passes a plain string through unchanged for string fields", () => {
    expect(coerceConfigValue("ollamaBaseUrl", "http://localhost:11434")).toBe("http://localhost:11434");
  });

  it("rejects an unknown config key", () => {
    expect(() => coerceConfigValue("nonexistentKey", "x")).toThrow(/Unknown config key/);
  });

  it("redirects provider/model/apiKeyEnvVar/providers/adminSystemPrompt to their own commands instead of coercing", () => {
    expect(() => coerceConfigValue("provider", "mistral")).toThrow(/codeagent use/);
    expect(() => coerceConfigValue("model", "x")).toThrow(/codeagent use/);
    expect(() => coerceConfigValue("apiKeyEnvVar", "X")).toThrow(/codeagent setup/);
    expect(() => coerceConfigValue("providers", "{}")).toThrow(/codeagent setup/);
    expect(() => coerceConfigValue("adminSystemPrompt", "text")).toThrow(/system-prompt set/);
  });
});

describe("setConfigValue", () => {
  let homedir;

  beforeEach(() => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-config-home-"));
  });

  afterEach(() => {
    fs.rmSync(homedir, { recursive: true, force: true });
  });

  it("persists a valid value to ~/.codeagentrc, readable back via loadConfig", () => {
    setConfigValue("sandboxMode", "off", { homedir });
    const config = loadConfig({}, { homedir });
    expect(config.sandboxMode).toBe("off");
  });

  it("returns the coerced value", () => {
    expect(setConfigValue("maxIterationsPerTurn", "42", { homedir })).toBe(42);
  });

  it("does not write anything to disk when the value is invalid", () => {
    const rcPath = path.join(homedir, ".codeagentrc");
    expect(() => setConfigValue("skillsIndexMode", "nonsense", { homedir })).toThrow();
    expect(fs.existsSync(rcPath)).toBe(false);
  });

  it("merges with existing config rather than overwriting other fields", () => {
    setConfigValue("sandboxMode", "off", { homedir });
    setConfigValue("planMode", "true", { homedir });
    const config = loadConfig({}, { homedir });
    expect(config.sandboxMode).toBe("off");
    expect(config.planMode).toBe(true);
  });
});

describe("INTERACTIVE_CONFIG_FIELDS", () => {
  it("never includes a redirected key (provider/model/apiKeyEnvVar/providers/adminSystemPrompt)", () => {
    const keys = INTERACTIVE_CONFIG_FIELDS.map((f) => f.key);
    expect(keys).not.toContain("provider");
    expect(keys).not.toContain("model");
    expect(keys).not.toContain("apiKeyEnvVar");
    expect(keys).not.toContain("providers");
    expect(keys).not.toContain("adminSystemPrompt");
  });

  it("every listed field is actually settable via coerceConfigValue without throwing on a sane value", () => {
    const sampleValues = {
      skillsIndexMode: "compact",
      sandboxMode: "auto",
      planMode: "false",
      planningEnabled: "false",
      yolo: "false",
      maxIterationsPerTurn: "25",
      logLevel: "info",
      allowedWritePaths: ".",
    };
    for (const field of INTERACTIVE_CONFIG_FIELDS) {
      expect(() => coerceConfigValue(field.key, sampleValues[field.key])).not.toThrow();
    }
  });
});
