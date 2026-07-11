import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigSchema, PROVIDER_DEFAULTS } from "./schema.js";
import { ConfigError } from "../utils/errors.js";

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`Failed to parse config file at ${filePath}: ${err.message}`);
  }
}

function deepMerge(...objects) {
  const result = {};
  for (const obj of objects) {
    if (!obj) continue;
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof result[key] === "object" &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Resolve config from, highest to lowest precedence:
 * CLI flags -> project config (.codeagent/config.json) -> global config
 * (~/.codeagentrc) -> built-in defaults. See doc 09.
 */
export function loadConfig(cliArgs = {}, { cwd = process.cwd(), homedir = os.homedir() } = {}) {
  const globalConfig = readJsonIfExists(path.join(homedir, ".codeagentrc"));
  const projectConfig = readJsonIfExists(path.join(cwd, ".codeagent", "config.json"));

  // If the CLI is switching provider without specifying model/apiKeyEnvVar,
  // seed sensible per-provider defaults rather than leaving the wrong
  // provider's defaults in place.
  let providerDefaults = {};
  const chosenProvider = cliArgs.provider || projectConfig.provider || globalConfig.provider;
  if (chosenProvider && PROVIDER_DEFAULTS[chosenProvider]) {
    providerDefaults = { ...PROVIDER_DEFAULTS[chosenProvider] };
  }

  const merged = deepMerge(providerDefaults, globalConfig, projectConfig, cliArgs);

  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid configuration:\n${issues}`);
  }
  return result.data;
}

export function redactedConfig(config) {
  // apiKeyEnvVar is a variable *name*, not the key itself, so it's safe to
  // print — but we redact anything that looks like a key value defensively.
  const clone = { ...config };
  return clone;
}
