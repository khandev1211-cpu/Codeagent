import readline from "node:readline";
import { runSetupWizard } from "./setup.js";
import { setConfigValue, INTERACTIVE_CONFIG_FIELDS } from "../config/setConfigValue.js";
import { loadConfig } from "../config/loader.js";

/**
 * "Provider & model" delegates entirely to the existing SetupWizard
 * (setup.js) rather than reimplementing provider selection here — same
 * reasoning `config set`'s REDIRECTS map gives for not letting a bare
 * `config set model x` bypass the logic that keeps `provider`/`model`/
 * `apiKeyEnvVar`/`providers` consistent with each other. One
 * implementation of "how to configure a provider," used by both the
 * fresh-install flow and this menu.
 */
const MENU_ITEMS = [{ key: "provider", label: "Provider & model", delegate: true }, ...INTERACTIVE_CONFIG_FIELDS];

/**
 * Every other field goes through the exact same `setConfigValue` the
 * non-interactive `codeagent config set <key> <value>` command uses
 * (docs/27) — this menu is a friendlier way to reach the same coercion
 * and validation, not a second implementation of it.
 */
export class ConfigManager {
  constructor({ logger = console, homedir } = {}) {
    this.logger = logger;
    this.homedir = homedir;
  }

  async run() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      await this._loop(rl);
    } finally {
      rl.close();
    }
  }

  async _loop(rl) {
    while (true) {
      const config = loadConfig({}, { homedir: this.homedir });
      console.log("\n⚙️  codeagent configuration\n");
      MENU_ITEMS.forEach((item, i) => {
        const current = item.delegate ? `${config.provider} (${config.model})` : JSON.stringify(config[item.key]);
        console.log(`  ${i + 1}. ${item.label}  [current: ${current}]`);
      });
      console.log(`  ${MENU_ITEMS.length + 1}. Done\n`);

      const choice = await this._prompt(rl, `Choose an option (1-${MENU_ITEMS.length + 1}): `);
      const num = parseInt(choice, 10);
      if (!Number.isInteger(num) || num === MENU_ITEMS.length + 1) {
        console.log("\nDone.\n");
        return;
      }
      const item = MENU_ITEMS[num - 1];
      if (!item) continue;

      if (item.delegate) {
        // SetupWizard creates and closes its own readline interface —
        // hand off control rather than nesting two readline interfaces
        // on the same stdin, then come back to a fresh menu loop
        // afterward so the "current" values reflect what just changed.
        rl.close();
        await runSetupWizard(config, this.logger, { homedir: this.homedir });
        return this.run();
      }

      await this._editField(rl, item, config);
    }
  }

  async _editField(rl, item, config) {
    let raw;
    if (item.type === "boolean") {
      raw = (await this._promptYesNo(rl, `${item.label}? (y/n): `)) ? "true" : "false";
    } else {
      if (item.type === "enum") console.log(`Options: ${item.options.join(", ")}`);
      raw = await this._prompt(rl, `New value (current: ${JSON.stringify(config[item.key])}): `);
    }

    if (!raw.trim()) {
      console.log("No change.\n");
      return;
    }

    try {
      const coerced = setConfigValue(item.key, raw, { homedir: this.homedir });
      console.log(`✅ ${item.key} = ${JSON.stringify(coerced)}\n`);
    } catch (err) {
      console.log(`⚠️  ${err.message}\n`);
    }
  }

  async _prompt(rl, question) {
    return new Promise((resolve) => rl.question(question, resolve));
  }

  async _promptYesNo(rl, question) {
    const answer = await this._prompt(rl, question);
    return answer.trim().toLowerCase() === "y";
  }
}

export async function runConfigManager({ logger, homedir } = {}) {
  return new ConfigManager({ logger, homedir }).run();
}
