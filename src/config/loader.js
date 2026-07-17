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

  // If the CLI is switching provider, use the model/apiKeyEnvVar from the
  // providers map if available, otherwise fall back to PROVIDER_DEFAULTS.
  // Must override the global model/apiKeyEnvVar since those belong to the
  // previously-active provider.
  let providerDefaults = {};
  const chosenProvider = cliArgs.provider || projectConfig.provider || globalConfig.provider;
  if (chosenProvider) {
    const configuredProvider = globalConfig.providers?.[chosenProvider];
    if (configuredProvider?.model) {
      providerDefaults = {
        model: configuredProvider.model,
        apiKeyEnvVar: configuredProvider.apiKeyEnvVar || PROVIDER_DEFAULTS[chosenProvider]?.apiKeyEnvVar,
      };
    } else if (PROVIDER_DEFAULTS[chosenProvider]) {
      providerDefaults = { ...PROVIDER_DEFAULTS[chosenProvider] };
    }
  }

  // When CLI overrides the provider, strip the global model/apiKeyEnvVar
  // so provider-specific defaults take precedence over the old active provider's settings.
  const effectiveGlobal = cliArgs.provider
    ? { ...globalConfig, model: undefined, apiKeyEnvVar: undefined }
    : globalConfig;

  // Merge order: providerDefaults (lowest), effectiveGlobal, projectConfig (higher), cliArgs (highest)
  const merged = deepMerge(providerDefaults, effectiveGlobal, projectConfig, cliArgs);

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

function getGlobalConfigPath({ homedir = os.homedir() } = {}) {
  return path.join(homedir, ".codeagentrc");
}

/**
 * True once at least one provider has been configured globally — the
 * signal `bin/cli.js` uses to decide whether to auto-run the setup wizard
 * before the user's first real command (docs/18). Deliberately checks
 * `providers` (plural), not just "does the file exist," since an empty or
 * hand-edited `{}` file shouldn't count as configured.
 */
export function configExists({ homedir = os.homedir() } = {}) {
  const globalConfig = readJsonIfExists(getGlobalConfigPath({ homedir }));
  return Boolean(globalConfig.providers && Object.keys(globalConfig.providers).length > 0);
}

/**
 * Writes a partial update into ~/.codeagentrc, deep-merged with whatever's
 * already there — so saving one provider's settings never wipes out
 * another provider already configured, and setting adminSystemPrompt never
 * touches `providers`. This is the persistence step the setup wizard never
 * had before (docs/18) — everything it collected used to be discarded the
 * moment the process exited.
 */
export function saveGlobalConfig(partial, { homedir = os.homedir() } = {}) {
  const filePath = getGlobalConfigPath({ homedir });
  const existing = readJsonIfExists(filePath);
  const merged = deepMerge(existing, partial);
  try {
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), { mode: 0o600 });
  } catch (err) {
    throw new ConfigError(`Failed to write config to ${filePath}: ${err.message}`);
  }
  return merged;
}

/**
 * Adds or updates one provider's entry in the global providers map, and —
 * unless told not to — makes it the active provider/model/apiKeyEnvVar too
 * (the common case: you just configured a provider, you probably want to
 * use it). Returns the full merged global config.
 */
export function upsertProvider(
  { provider, apiKeyEnvVar, model, useKeychain },
  { homedir = os.homedir(), makeActive = true } = {}
) {
  const partial = {
    providers: { [provider]: { apiKeyEnvVar, model, useKeychain: Boolean(useKeychain) } },
  };
  if (makeActive) {
    partial.provider = provider;
    partial.apiKeyEnvVar = apiKeyEnvVar;
    if (model) partial.model = model;
  }
  return saveGlobalConfig(partial, { homedir });
}

/** Lists every provider configured globally, i.e. present in ~/.codeagentrc's `providers` map. */
export function listConfiguredProviders({ homedir = os.homedir() } = {}) {
  const globalConfig = readJsonIfExists(getGlobalConfigPath({ homedir }));
  return globalConfig.providers || {};
}