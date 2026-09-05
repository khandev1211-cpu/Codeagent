import { ConfigSchema } from "./schema.js";
import { saveGlobalConfig } from "./loader.js";
import { ConfigError } from "../utils/errors.js";

/**
 * Fields that already have their own dedicated command — `config set`
 * redirects to those instead of offering a second way to do the same
 * thing (which would risk the two paths drifting: e.g. `codeagent use`
 * already handles keeping `provider`/`model`/`apiKeyEnvVar` consistent
 * with the `providers` map, something a bare `config set model x` could
 * easily do wrong).
 */
const REDIRECTS = {
  provider: 'Use "codeagent use <provider> [model]" to switch providers.',
  model: 'Use "codeagent use <provider> <model>" to change the model.',
  apiKeyEnvVar: 'Use "codeagent setup" to configure a provider\'s API key.',
  providers: 'Use "codeagent setup" to add or reconfigure a provider.',
  adminSystemPrompt: 'Use \'codeagent system-prompt set "<text>"\' instead.',
};

/** Unwraps ZodDefault/ZodOptional to get at the actual leaf type (boolean/enum/number/array/string) a field's raw CLI string needs coercing into. */
function unwrapZodType(schema) {
  let s = schema;
  while (s?._def?.innerType) s = s._def.innerType;
  return s;
}

/**
 * Converts a raw CLI string into the type `key`'s schema actually expects,
 * then validates it against that field's own zod shape in isolation —
 * not the whole resolved config, which is a multi-layer merge (docs/09)
 * that doesn't correspond to what's actually written to any one file.
 * Pure and side-effect-free so it's testable without touching disk.
 */
export function coerceConfigValue(key, rawValue) {
  const fieldSchema = ConfigSchema.shape[key];
  if (!fieldSchema) {
    throw new ConfigError(
      `Unknown config key: "${key}". Run "codeagent config" to see every resolved field, or "codeagent config validate" to check a hand-edited file.`
    );
  }
  if (REDIRECTS[key]) {
    throw new ConfigError(`"${key}" has its own command — ${REDIRECTS[key]}`);
  }

  const unwrapped = unwrapZodType(fieldSchema);
  const typeName = unwrapped._def.typeName;

  let coerced;
  if (typeName === "ZodBoolean") {
    const lower = rawValue.trim().toLowerCase();
    if (lower === "true") coerced = true;
    else if (lower === "false") coerced = false;
    else throw new ConfigError(`"${key}" expects true or false, got "${rawValue}".`);
  } else if (typeName === "ZodNumber") {
    const n = Number(rawValue);
    if (Number.isNaN(n)) throw new ConfigError(`"${key}" expects a number, got "${rawValue}".`);
    coerced = n;
  } else if (typeName === "ZodArray") {
    coerced = rawValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    // ZodEnum and ZodString both take the raw string as-is — the enum's
    // own .safeParse below is what actually rejects an invalid option,
    // with a message naming the valid ones.
    coerced = rawValue;
  }

  const result = fieldSchema.safeParse(coerced);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    throw new ConfigError(`Invalid value for "${key}": ${messages}`);
  }
  return result.data;
}

/** Coerces + validates + persists in one call — the single path both `codeagent config set` and the interactive manager (`configManager.js`) go through, so there's exactly one implementation of "what's a valid value for this key," not two that could drift apart. */
export function setConfigValue(key, rawValue, { homedir } = {}) {
  const coerced = coerceConfigValue(key, rawValue);
  saveGlobalConfig({ [key]: coerced }, { homedir });
  return coerced;
}

/**
 * Keys offered by the interactive manager and documented as settable via
 * `config set` — deliberately excludes the REDIRECTS keys above (they're
 * reachable via their own commands, not listed here as a second path) and
 * `maxTokenBudgetPerSession`/`ollamaBaseUrl`/`customSystemPromptAddendum`
 * (optional, narrower-audience fields — still settable via `config set`
 * directly by key name, just not cluttering the interactive menu's
 * default list).
 */
export const INTERACTIVE_CONFIG_FIELDS = [
  { key: "skillsIndexMode", label: "Skills index mode", type: "enum", options: ["compact", "full"] },
  { key: "sandboxMode", label: "Sandbox mode (run_bash writes)", type: "enum", options: ["auto", "off"] },
  { key: "planMode", label: "Plan Mode default (read-only, whole session)", type: "boolean" },
  { key: "planningEnabled", label: "Show a plan before executing", type: "boolean" },
  { key: "yolo", label: "Skip confirmation prompts by default (--yolo)", type: "boolean" },
  { key: "maxIterationsPerTurn", label: "Max tool-call iterations per turn", type: "number" },
  { key: "logLevel", label: "Log level", type: "enum", options: ["debug", "info", "warn", "error"] },
  { key: "allowedWritePaths", label: "Allowed write paths (comma-separated)", type: "array" },
  { key: "theme", label: "TUI color theme", type: "enum", options: ["default", "monochrome", "high-contrast"] },
  { key: "vimKeybindings", label: "Vim-style keybindings in the TUI input box", type: "boolean" },
  { key: "autonomousMode", label: "Autonomous Mode: mandatory planning, no confirmation prompts, self-verification (docs/31)", type: "boolean" },
];
