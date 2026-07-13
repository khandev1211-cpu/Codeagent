import os from "os";
import readline from "readline";
import { KeychainManager } from "../utils/keychain.js";
import { ModelRegistry } from "../providers/modelRegistry.js";
import { PROVIDER_DEFAULTS } from "../config/schema.js";
import { upsertProvider, listConfiguredProviders } from "../config/loader.js";

const ALL_PROVIDERS = [
  { name: "Anthropic (Claude)", value: "anthropic", description: "Most capable, most expensive", free: false },
  { name: "Mistral AI", value: "mistral", description: "Fast, good quality", free: true },
  { name: "Groq", value: "groq", description: "Ultra-fast, free tier available", free: true },
  { name: "Cerebras", value: "cerebras", description: "Very fast inference", free: true },
  { name: "OpenRouter", value: "openrouter", description: "Multi-model marketplace", free: true },
  { name: "Ollama (Local)", value: "ollama", description: "Run locally, no API key needed", free: true },
];

/**
 * Interactive setup wizard. First run: walks through provider selection,
 * API key, and model. Every run after that (docs/18): detects what's
 * already configured in ~/.codeagentrc and offers to add another
 * provider, switch the active one, or reconfigure a key — rather than
 * blindly repeating the fresh-install flow.
 *
 * Persistence happens as each step completes (via upsertProvider,
 * config/loader.js), not by returning a value for the caller to save —
 * that indirection is exactly how this used to silently discard
 * everything the wizard collected.
 */
export class SetupWizard {
  constructor({ config, logger = console, homedir = os.homedir() } = {}) {
    this.config = config;
    this.logger = logger;
    this.homedir = homedir;
    this.keychain = new KeychainManager({ logger });
    this.modelRegistry = new ModelRegistry({ logger });
  }

  async run() {
    console.clear?.();
    const alreadyConfigured = listConfiguredProviders({ homedir: this.homedir });
    const hasExisting = Object.keys(alreadyConfigured).length > 0;

    console.log("🤖 Welcome to CodeAgent!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const rl = this._createReadline();
    try {
      if (hasExisting) {
        return await this._runReturningUserMenu(rl, alreadyConfigured);
      }
      return await this._runFreshSetup(rl);
    } finally {
      rl.close();
    }
  }

  async _runFreshSetup(rl) {
    const provider = await this._selectProvider(rl);
    const result = await this._configureProvider(rl, provider, { makeActive: true });
    console.log("✨ Setup complete! codeagent is ready — just run `codeagent` again.\n");
    console.log('Tip: run "codeagent setup" again anytime to add another provider, switch your default, or reconfigure a key.');
    console.log('Tip: set a standing instruction for every project with "codeagent system-prompt set".\n');
    return result;
  }

  async _runReturningUserMenu(rl, alreadyConfigured) {
    console.log("You already have codeagent configured:\n");
    for (const [name, cfg] of Object.entries(alreadyConfigured)) {
      console.log(`  - ${name} (${cfg.model || "default model"})`);
    }
    console.log();
    console.log("  1. Add another provider");
    console.log("  2. Switch active provider / model");
    console.log("  3. Reconfigure a provider's key");
    console.log("  4. Done\n");

    const choice = await this._prompt(rl, "Choose an option (1-4): ", (val) => {
      const num = parseInt(val, 10);
      return num >= 1 && num <= 4 ? num : null;
    });

    if (choice === 1) {
      const provider = await this._selectProvider(rl, { exclude: Object.keys(alreadyConfigured) });
      if (!provider) {
        console.log("\nEvery supported provider is already configured. Use option 3 to reconfigure one.\n");
        return { alreadyConfigured };
      }
      return this._configureProvider(rl, provider, { makeActive: true });
    }
    if (choice === 2) {
      return this._switchActive(rl, alreadyConfigured);
    }
    if (choice === 3) {
      const provider = await this._selectFromConfigured(rl, alreadyConfigured);
      return this._configureProvider(rl, provider, { makeActive: false });
    }
    console.log("\nNo changes made.\n");
    return { alreadyConfigured };
  }

  async _switchActive(rl, alreadyConfigured) {
    const provider = await this._selectFromConfigured(rl, alreadyConfigured);
    const existing = alreadyConfigured[provider];
    const model = await this._selectModel(rl, provider);
    const merged = upsertProvider(
      { provider, apiKeyEnvVar: existing.apiKeyEnvVar, model, useKeychain: existing.useKeychain },
      { homedir: this.homedir, makeActive: true }
    );
    console.log(`\n✅ ${provider} (${model}) is now the active provider.\n`);
    return merged;
  }

  async _configureProvider(rl, provider, { makeActive = true } = {}) {
    const apiKey = await this._getApiKey(rl, provider);
    const model = await this._selectModel(rl, provider);
    const apiKeyEnvVar = PROVIDER_DEFAULTS[provider]?.apiKeyEnvVar;
    const useKeychain =
      provider !== "ollama" && apiKey ? await this._confirmKeychain(rl) : false;

    if (useKeychain && apiKey) {
      try {
        await this.keychain.saveKey(provider, apiKey);
        console.log("✅ API key saved to keychain\n");
      } catch (error) {
        console.log(`⚠️  Keychain save failed: ${error.message}`);
        console.log("   Key will be read from the environment variable instead.\n");
      }
    }

    const merged = upsertProvider(
      { provider, apiKeyEnvVar, model, useKeychain },
      { homedir: this.homedir, makeActive }
    );

    console.log(`\n✅ Saved ${provider} (${model}) to ~/.codeagentrc${makeActive ? " and set it as active" : ""}.`);
    if (!useKeychain && provider !== "ollama") {
      console.log(`   Remember to set ${apiKeyEnvVar} in your shell environment before running codeagent.`);
    }
    console.log();

    return merged;
  }

  /**
   * Select an LLM provider interactively. `exclude` filters out already-
   * configured providers when adding another one — returns null if that
   * leaves nothing to choose from.
   */
  async _selectProvider(rl, { exclude = [] } = {}) {
    console.log("📦 Select LLM Provider\n");
    const providers = ALL_PROVIDERS.filter((p) => !exclude.includes(p.value));
    if (providers.length === 0) return null;

    providers.forEach((p, i) => {
      const freeTag = p.free ? " 🆓" : "";
      console.log(`  ${i + 1}. ${p.name}${freeTag}`);
      console.log(`     ${p.description}\n`);
    });

    const choice = await this._prompt(rl, `Choose provider (1-${providers.length}): `, (val) => {
      const num = parseInt(val, 10);
      return num >= 1 && num <= providers.length ? num : null;
    });

    const selected = providers[choice - 1];
    console.log(`✓ Selected: ${selected.name}\n`);
    return selected.value;
  }

  async _selectFromConfigured(rl, alreadyConfigured) {
    const names = Object.keys(alreadyConfigured);
    names.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));
    console.log();
    const choice = await this._prompt(rl, `Choose provider (1-${names.length}): `, (val) => {
      const num = parseInt(val, 10);
      return num >= 1 && num <= names.length ? num : null;
    });
    return names[choice - 1];
  }

  /**
   * Get an API key from the user, offering to reuse whatever's already
   * findable (env var, or a previously saved keychain entry) first.
   */
  async _getApiKey(rl, provider) {
    console.log("🔑 API Key\n");

    if (provider === "ollama") {
      console.log("ℹ️  Ollama runs locally and doesn't require an API key.\n");
      return null;
    }

    const envVar = PROVIDER_DEFAULTS[provider]?.apiKeyEnvVar;
    const existingEnvKey = process.env[envVar];
    const existingKeychainKey = existingEnvKey ? null : await this.keychain.getKey(provider).catch(() => null);
    const existingKey = existingEnvKey || existingKeychainKey;

    if (existingKey) {
      const source = existingEnvKey ? `the ${envVar} environment variable` : "the OS keychain";
      console.log(`Found an existing key in ${source}.\n`);
      const use = await this._promptYesNo(rl, "Use it? (y/n): ");
      if (use) {
        console.log("✓ Using existing API key\n");
        return existingKey;
      }
    }

    const link = this._getProviderSetupLink(provider);
    console.log(`Get your API key at: ${link}\n`);

    const key = await this._prompt(
      rl,
      "Paste your API key (hidden): ",
      (val) => (val.trim().length > 0 ? val.trim() : null),
      true
    );

    return key;
  }

  async _selectModel(rl, provider) {
    console.log("\n📊 Select Default Model\n");

    if (provider === "ollama") {
      // No key required, but the registry still needs a reachable local
      // server to list models — fall through to the provider default
      // quietly rather than treating an unreachable localhost as an error.
    }

    try {
      const models = await this.modelRegistry.getAvailableModels(provider);

      if (models.length === 0) {
        console.log("No models found. Using provider default.\n");
        return PROVIDER_DEFAULTS[provider]?.model;
      }

      models.forEach((m, i) => {
        const price =
          m.costPer1kInputTokens > 0 || m.costPer1kOutputTokens > 0
            ? ` ($${(m.costPer1kInputTokens * 1000).toFixed(2)}/1M tokens)`
            : " (free)";
        const toolUse = m.supportsToolUse ? " ✓ tool_use" : "";
        console.log(`  ${i + 1}. ${m.name}${price}${toolUse}`);
      });
      console.log();

      const choice = await this._prompt(rl, `Choose model (1-${models.length}): `, (val) => {
        const num = parseInt(val, 10);
        return num >= 1 && num <= models.length ? num : null;
      });

      const selected = models[choice - 1];
      console.log(`✓ Selected: ${selected.name}\n`);
      return selected.id;
    } catch (error) {
      this.logger.debug("Failed to fetch models:", error.message);
      console.log("Using provider default model.\n");
      return PROVIDER_DEFAULTS[provider]?.model;
    }
  }

  async _confirmKeychain(rl) {
    console.log("🔐 Security\n");
    console.log("Save API key to system keychain for future sessions?");
    console.log("  ✓ No need to re-export an env var every session");
    console.log("  ✓ Stored via your OS credential manager, not a plaintext env file\n");

    return this._promptYesNo(rl, "Save to keychain? (y/n): ");
  }

  async _prompt(rl, question, validator = null, hidden = false) {
    return new Promise((resolve) => {
      if (hidden) {
        const stdin = process.stdin;
        const originalMode = stdin.isRaw;

        if (typeof stdin.setRawMode !== "function") {
          rl.question(question, (answer) => {
            if (validator && !validator(answer)) {
              console.log("Invalid input. Try again.\n");
              resolve(this._prompt(rl, question, validator, hidden));
              return;
            }
            resolve(answer);
          });
          return;
        }

        stdin.setRawMode(true);
        stdin.setEncoding("utf8");
        stdin.resume();

        let input = "";
        let settled = false;

        const cleanup = () => {
          stdin.removeListener("data", onData);
          stdin.setRawMode(Boolean(originalMode));
          stdin.pause();
        };

        const onData = (chunk) => {
          if (settled) return;
          const str = typeof chunk === "string" ? chunk : chunk.toString("utf8");
          for (const char of str) {
            const code = char.charCodeAt(0);
            if (code === 3) {
              cleanup();
              settled = true;
              process.exit(0);
              return;
            } else if (code === 13 || code === 10) {
              cleanup();
              settled = true;
              console.log();
              if (validator && !validator(input)) {
                console.log("Invalid input. Try again.\n");
                resolve(this._prompt(rl, question, validator, hidden));
                return;
              }
              resolve(input);
              return;
            } else if (code === 127 || code === 8) {
              input = input.slice(0, -1);
            } else if (code >= 32) {
              input += char;
            }
          }
        };

        process.stdout.write(question);
        stdin.on("data", onData);
      } else {
        rl.question(question, (answer) => {
          if (validator && !validator(answer)) {
            console.log("Invalid input. Try again.\n");
            resolve(this._prompt(rl, question, validator, hidden));
            return;
          }
          resolve(answer);
        });
      }
    });
  }

  async _promptYesNo(rl, question) {
    const answer = await this._prompt(rl, question, (val) => {
      return val.toLowerCase() === "y" || val.toLowerCase() === "n" ? val.toLowerCase() : null;
    });
    return answer === "y";
  }

  _createReadline() {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
  }

  _getProviderSetupLink(provider) {
    const links = {
      anthropic: "https://console.anthropic.com/account/keys",
      mistral: "https://console.mistral.ai/api-keys/",
      groq: "https://console.groq.com/keys",
      cerebras: "https://console.cerebras.ai/api-keys",
      openrouter: "https://openrouter.ai/keys",
      ollama: "https://ollama.ai",
    };
    return links[provider] || "https://codeagent.ai/setup";
  }
}

export async function runSetupWizard(config, logger, { homedir } = {}) {
  const wizard = new SetupWizard({ config, logger, homedir });
  return wizard.run();
}
