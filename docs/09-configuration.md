# 09 — Configuration

## Layering (highest to lowest precedence)

1. **CLI flags** — e.g. `--yolo`, `--model`, `--provider` passed directly on invocation.
2. **Project config** — `.codeagent/config.json` in the current project root, for settings specific to that repo (e.g. a broader allowed write-path, a project-specific system prompt addendum).
3. **Global user config** — `~/.codeagentrc`, for user-wide defaults (default model, default max-iterations).
4. **Built-in defaults** — hardcoded fallbacks in `src/config/schema.js` so the tool works out of the box with zero config.

Each layer only needs to specify what it wants to override — everything else falls through to the next layer down.

## Resolution (`src/config/loader.js`)

```js
function loadConfig(cliArgs) {
  const defaults = getDefaults();
  const globalConfig = readIfExists(path.join(os.homedir(), ".codeagentrc"));
  const projectConfig = readIfExists(path.join(process.cwd(), ".codeagent", "config.json"));
  const merged = deepMerge(defaults, globalConfig, projectConfig, cliArgs);
  return ConfigSchema.parse(merged); // throws a clear error on invalid config
}
```

Loaded once at boot, the resolved object is what every other layer (Agent Core, Provider Layer, Safety Layer) reads from — nothing else reads raw config files directly, so there's exactly one source of truth for "what is the actual active configuration right now."

## Schema (`src/config/schema.js`, zod)

Representative fields — not exhaustive, but the ones every layer depends on:

```js
const ConfigSchema = z.object({
  provider: z.enum(["anthropic"]).default("anthropic"),
  model: z.string().default("claude-sonnet-4-6"),
  apiKeyEnvVar: z.string().default("ANTHROPIC_API_KEY"),
  maxIterationsPerTurn: z.number().int().positive().default(25),
  maxTokenBudgetPerSession: z.number().int().positive().optional(),
  yolo: z.boolean().default(false),
  allowedWritePaths: z.array(z.string()).default(["."]), // relative to project root
  planningEnabled: z.boolean().default(false),
  customSystemPromptAddendum: z.string().optional(),
});
```

Validation failure produces a clear, specific error message (which field, what was wrong) at boot, before any API calls happen — not a cryptic downstream failure mid-session.

## API key sourcing

- Read from the environment variable named in `apiKeyEnvVar` (default `ANTHROPIC_API_KEY`) first — **never** stored directly in a config file.
- If the env var isn't set, falls back to the OS keychain (if `codeagent setup` saved one there) before failing — see doc 18 for the full resolution order (`src/providers/resolveApiKey.js`). Only if neither is found does boot fail, with a clear instruction rather than a cryptic downstream failure mid-session.

## Multi-provider config and the admin system prompt

`ConfigSchema` also carries a `providers` map (every provider ever configured via `codeagent setup`, not just the active one) and an optional `adminSystemPrompt` (a global, priority-layered standing instruction). These are additive to the schema above and don't change how `provider`/`model`/`apiKeyEnvVar` resolve — full detail in doc 18, since they're really about the setup/provider-management story, not the config-loading mechanics this doc owns.

## Project vs. global config — what belongs where

| Setting | Belongs in |
|---|---|
| API key | Environment variable, never a file |
| Default model choice | Global (`~/.codeagentrc`) — personal preference |
| `allowedWritePaths` broader than project root | Project config — this is a property of the specific repo's needs |
| `maxIterationsPerTurn` override for a particularly complex repo | Project config |
| `--yolo` | CLI flag only, by convention — even though it's technically settable in config, defaulting it on globally is discouraged in the README, since it removes the safety net silently for every future session rather than being a conscious per-run choice |

## Testing this layer

Config tests cover: each layer correctly overrides the one below it, invalid values produce the expected zod error rather than silently coercing to something wrong, and missing API key env var fails fast with a clear message (doc 12).
