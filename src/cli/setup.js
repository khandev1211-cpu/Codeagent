import readline from "readline";
import { KeychainManager } from "../utils/keychain.js";
import { ModelRegistry } from "../providers/modelRegistry.js";
import { PROVIDER_DEFAULTS } from "../config/schema.js";

/**
 * Interactive setup wizard for first-time users.
 * Guides through: provider selection, API key setup, model selection.
 */
export class SetupWizard {
  constructor({ config, logger = console } = {}) {
    this.config = config;
    this.logger = logger;
    this.keychain = new KeychainManager({ logger });
    this.modelRegistry = new ModelRegistry({ logger });
  }

  /**
   * Run the full setup flow interactively.
   * Returns a config object to merge with existing config.
   */
  async run() {
    console.clear?.();
    console.log("🤖 Welcome to CodeAgent!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const rl = this._createReadline();

    try {
      const provider = await this._selectProvider(rl);
      const apiKey = await this._getApiKey(rl, provider);
      const model = await this._selectModel(rl, provider);
      const useKeychain = await this._confirmKeychain(rl);

      if (useKeychain && apiKey) {
        try {
          await this.keychain.saveKey(provider, apiKey);
          console.log("✅ API key saved to keychain\n");
        } catch (error) {
          console.log(`⚠️  Keychain save failed: ${error.message}`);
          console.log("   Key will be read from environment variable instead.\n");
        }
      }

      console.log("\n✨ Setup complete!\n");
      console.log("Saved configuration:");
      console.log(`  Provider: ${provider}`);
      console.log(`  Model: ${model}`);
      console.log(`  API Key: ${useKeychain ? "in keychain" : "from environment"}\n`);

      return {
        provider,
        model,
        apiKeyEnvVar: PROVIDER_DEFAULTS[provider]?.apiKeyEnvVar,
      };
    } finally {
      rl.close();
    }
  }

  /**
   * Select LLM provider interactively.
   */
  async _selectProvider(rl) {
    console.log("📦 Step 1: Select LLM Provider\n");

    const providers = [
      {
        name: "Anthropic (Claude)",
        value: "anthropic",
        description: "Most capable, most expensive",
        free: false,
      },
      {
        name: "Mistral AI",
        value: "mistral",
        description: "Fast, good quality",
        free: true,
      },
      {
        name: "Groq",
        value: "groq",
        description: "Ultra-fast, free tier available",
        free: true,
      },
      {
        name: "Cerebras",
        value: "cerebras",
        description: "Very fast inference",
        free: true,
      },
      {
        name: "OpenRouter",
        value: "openrouter",
        description: "Multi-model marketplace",
        free: true,
      },
      {
        name: "Ollama (Local)",
        value: "ollama",
        description: "Run locally, no API key needed",
        free: true,
      },
    ];

    providers.forEach((p, i) => {
      const freeTag = p.free ? " 🆓" : "";
      console.log(`  ${i + 1}. ${p.name}${freeTag}`);
      console.log(`     ${p.description}\n`);
    });

    const choice = await this._prompt(rl, "Choose provider (1-6): ", (val) => {
      const num = parseInt(val);
      return num >= 1 && num <= providers.length ? num : null;
    });

    const selected = providers[choice - 1];
    console.log(`✓ Selected: ${selected.name}\n`);
    return selected.value;
  }

  /**
   * Get API key from user (or use existing from env).
   */
  async _getApiKey(rl, provider) {
    console.log("🔑 Step 2: API Key\n");

    const envVar = PROVIDER_DEFAULTS[provider]?.apiKeyEnvVar;
    const existingKey = process.env[envVar];

    if (existingKey) {
      console.log(`Found ${envVar} in environment.\n`);
      const use = await this._promptYesNo(rl, "Use existing key? (y/n): ");
      if (use) {
        console.log("✓ Using existing API key\n");
        return existingKey;
      }
    }

    if (provider === "ollama") {
      console.log("ℹ️  Ollama runs locally and doesn't require an API key.\n");
      return null;
    }

    const link = this._getProviderSetupLink(provider);
    console.log(`Get your API key at: ${link}\n`);

    const key = await this._prompt(rl, "Paste your API key (hidden): ", (val) => {
      return val.trim().length > 0 ? val.trim() : null;
    }, true);

    return key;
  }

  /**
   * Select default model interactively.
   */
  async _selectModel(rl, provider) {
    console.log("\n📊 Step 3: Select Default Model\n");

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
        const num = parseInt(val);
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

  /**
   * Ask if user wants to save API key to keychain.
   */
  async _confirmKeychain(rl) {
    console.log("🔐 Step 4: Security\n");
    console.log("Save API key to system keychain for future sessions?");
    console.log("  ✓ More secure (encrypted OS storage)");
    console.log("  ✓ Faster (no env var needed each session)\n");

    return this._promptYesNo(rl, "Save to keychain? (y/n): ");
  }

  /**
   * Helper: prompt with validation.
   */
  async _prompt(rl, question, validator = null, hidden = false) {
    return new Promise((resolve) => {
      if (hidden) {
        // For hidden input, we need special handling
        const stdin = process.stdin;
        const originalMode = stdin.isRaw;

        stdin.setRawMode(true);
        stdin.resume();

        let input = "";

        const onData = (char) => {
          const code = char.charCodeAt(0);
          if (code === 3) {
            // Ctrl+C
            stdin.setRawMode(originalMode);
            process.exit(0);
          } else if (code === 13) {
            // Enter
            stdin.removeListener("data", onData);
            stdin.setRawMode(originalMode);
            stdin.pause();
            console.log(); // newline

            if (validator && !validator(input)) {
              console.log("Invalid input. Try again.\n");
              resolve(this._prompt(rl, question, validator, hidden));
              return;
            }
            resolve(input);
          } else if (code === 127 || code === 8) {
            // Backspace
            input = input.slice(0, -1);
          } else if (code >= 32) {
            input += char;
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

  /**
   * Helper: yes/no prompt.
   */
  async _promptYesNo(rl, question) {
    const answer = await this._prompt(rl, question, (val) => {
      return val.toLowerCase() === "y" || val.toLowerCase() === "n" ? val.toLowerCase() : null;
    });
    return answer === "y";
  }

  /**
   * Helper: create readline interface.
   */
  _createReadline() {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Get provider setup link.
   */
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

export async function runSetupWizard(config, logger) {
  const wizard = new SetupWizard({ config, logger });
  return wizard.run();
}
