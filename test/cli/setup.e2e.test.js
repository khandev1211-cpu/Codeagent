import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SetupWizard } from "../../src/cli/setup.js";
import { loadConfig, listConfiguredProviders } from "../../src/config/loader.js";

/**
 * Drives the wizard's real decision flow end to end: a fake stdin that
 * delivers queued answers whenever _prompt asks a question, separately
 * queued for hidden (API key) vs visible prompts. This tests the actual
 * persistence bug fix — the wizard used to return a value nobody saved;
 * these tests assert the config on disk, not the return value.
 */
function makeDrivenWizard({ homedir, visibleAnswers, hiddenAnswers = [] }) {
  const wizard = new SetupWizard({ logger: { warn: () => {}, debug: () => {} }, homedir });
  const visibleQueue = [...visibleAnswers];
  const hiddenQueue = [...hiddenAnswers];

  // Stub _prompt itself rather than the TTY internals — this exercises all
  // the *decision* logic (which menu branch, what gets persisted) without
  // re-testing keystroke handling already covered in setup.test.js.
  wizard._prompt = async (_rl, _question, validator, hidden) => {
    const queue = hidden ? hiddenQueue : visibleQueue;
    const answer = queue.shift();
    if (answer === undefined) throw new Error("Driven wizard ran out of scripted answers");
    if (validator) {
      const validated = validator(answer);
      if (validated === null) throw new Error(`Scripted answer "${answer}" failed validation`);
      return validated;
    }
    return answer;
  };
  wizard._createReadline = () => ({ close: () => {} });
  // Avoid real network calls to a model registry during tests — every
  // provider falls back to PROVIDER_DEFAULTS when the registry returns
  // nothing, which is exactly what we want here.
  wizard.modelRegistry = { getAvailableModels: async () => [] };
  // No real OS keychain during tests.
  wizard.keychain = { saveKey: async () => true, getKey: async () => null };
  return wizard;
}

describe("SetupWizard end-to-end persistence (docs/18)", () => {
  let tmpHome;

  afterEach(() => {
    if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("fresh setup persists provider/model/key-source to ~/.codeagentrc, not just the return value", async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-setup-e2e-"));
    const wizard = makeDrivenWizard({
      homedir: tmpHome,
      // 1) choose provider #2 (mistral)  2) confirm keychain save? "n"
      visibleAnswers: ["2", "n"],
      hiddenAnswers: ["sk-mistral-test-key"],
    });

    await wizard.run();

    // The real assertion: read it back from disk exactly the way a fresh
    // process would, completely independent of whatever run() returned.
    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.provider).toBe("mistral");
    expect(resolved.apiKeyEnvVar).toBe("MISTRAL_API_KEY");
    expect(Object.keys(listConfiguredProviders({ homedir: tmpHome }))).toEqual(["mistral"]);
  });

  it("second run detects the existing provider and offers the returning-user menu instead of the fresh flow", async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-setup-e2e-"));
    await makeDrivenWizard({
      homedir: tmpHome,
      visibleAnswers: ["1", "n"],
      hiddenAnswers: ["sk-anthropic-test-key"],
    }).run();

    // Second run: menu option 1 ("Add another provider"), then pick
    // mistral from the filtered (anthropic-excluded) provider list.
    const secondWizard = makeDrivenWizard({
      homedir: tmpHome,
      visibleAnswers: ["1", "1", "n"],
      hiddenAnswers: ["sk-mistral-test-key"],
    });
    await secondWizard.run();

    const configured = listConfiguredProviders({ homedir: tmpHome });
    expect(Object.keys(configured).sort()).toEqual(["anthropic", "mistral"]);
    // Adding a second provider makes it active, per _configureProvider's default.
    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.provider).toBe("mistral");
  });

  it('"add another provider" excludes already-configured providers from the list', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-setup-e2e-"));
    const wizard = makeDrivenWizard({ homedir: tmpHome, visibleAnswers: [] });
    const provider = await wizard._selectProvider(
      {},
      { exclude: ["anthropic", "mistral", "groq", "cerebras", "openrouter", "ollama"] }
    );
    // Every supported provider excluded -> nothing left to choose.
    expect(provider).toBeNull();
  });

  it("switching the active provider updates provider/model without losing other configured providers", async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-setup-e2e-"));
    await makeDrivenWizard({
      homedir: tmpHome,
      visibleAnswers: ["1", "n"],
      hiddenAnswers: ["sk-anthropic-test-key"],
    }).run();
    await makeDrivenWizard({
      homedir: tmpHome,
      visibleAnswers: ["1", "1", "n"],
      hiddenAnswers: ["sk-mistral-test-key"],
    }).run();

    // Third run: menu option 2 ("switch active"), pick provider #1 in the
    // configured list (anthropic, insertion order), then a model.
    const thirdWizard = makeDrivenWizard({ homedir: tmpHome, visibleAnswers: ["2", "1"] });
    await thirdWizard.run();

    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.provider).toBe("anthropic");
    expect(Object.keys(listConfiguredProviders({ homedir: tmpHome })).sort()).toEqual([
      "anthropic",
      "mistral",
    ]);
  });

  it('"reconfigure a key" does not change which provider is active', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-setup-e2e-"));
    await makeDrivenWizard({
      homedir: tmpHome,
      visibleAnswers: ["1", "n"],
      hiddenAnswers: ["sk-anthropic-test-key"],
    }).run();
    await makeDrivenWizard({
      homedir: tmpHome,
      visibleAnswers: ["1", "1", "n"],
      hiddenAnswers: ["sk-mistral-test-key"],
    }).run();
    // mistral is active at this point (adding a provider makes it active).

    // Reconfigure anthropic's key (menu 3 -> pick provider #1 -> new key -> no keychain).
    await makeDrivenWizard({
      homedir: tmpHome,
      visibleAnswers: ["3", "1", "n"],
      hiddenAnswers: ["sk-anthropic-rotated-key"],
    }).run();

    const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
    expect(resolved.provider).toBe("mistral"); // unchanged by a key reconfigure
  });

  it("offers to reuse an existing env-var key instead of prompting for a new one", async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-setup-e2e-"));
    process.env.MISTRAL_API_KEY = "sk-already-in-env";
    try {
      const wizard = makeDrivenWizard({
        homedir: tmpHome,
        // choose provider #2 (mistral), "y" to reuse existing key, "n" to keychain
        visibleAnswers: ["2", "y", "n"],
        hiddenAnswers: [],
      });
      await wizard.run();
      const resolved = loadConfig({}, { cwd: tmpHome, homedir: tmpHome });
      expect(resolved.provider).toBe("mistral");
    } finally {
      delete process.env.MISTRAL_API_KEY;
    }
  });
});
