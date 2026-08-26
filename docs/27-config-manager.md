# 27 — Interactive Config Manager

Tier 2, Phase 9.2. The config surface finally settled after all of Tier 1 shipped (`skillsIndexMode`, `sandboxMode`, `planMode`, and more all landed only in the last several sessions) — building an interactive manager any earlier would have meant redoing it after every phase; building it now means covering the real, actual surface once.

## Three ways in, one shared validation path

- **`codeagent config`** — unchanged, prints the fully resolved config (redacted).
- **`codeagent config set <key> <value>`** — scriptable, for CI/dotfiles.
- **`codeagent config validate`** — validates the fully resolved config and reports which field failed, if any.
- **`codeagent config --interactive` / `-i`** — a guided menu.

`set` and the interactive menu both go through the exact same `setConfigValue()` (`src/config/setConfigValue.js`) — one implementation of "coerce this raw string into the right type, then validate it," not two that could silently drift apart. The interactive menu is a friendlier way to reach the same function, not a parallel reimplementation of what counts as a valid value.

## Reuse SetupWizard for provider/model, don't reimplement it

"Provider & model" in the interactive menu delegates entirely to the existing `SetupWizard` (`setup.js`, `docs/18`) rather than rebuilding provider selection here. Same reasoning `config set`'s redirect map gives for `provider`/`model`/`apiKeyEnvVar`/`providers`: those four are kept consistent with each other by `upsertProvider()`'s specific logic, and a bare `config set model x` bypassing that could easily leave the `providers` map and the active selection out of sync. One implementation of "how to configure a provider," used by both the fresh-install flow and this menu — the menu just closes its own readline interface and hands off to the wizard's, then restarts itself afterward so the displayed "current" values reflect what just changed.

## Type coercion from the schema itself, not a second table

`coerceConfigValue()` introspects each field's actual `zod` shape (`ConfigSchema.shape[key]`, unwrapping `ZodDefault`/`ZodOptional` to find the real leaf type) to decide how to parse a raw CLI string — boolean fields accept `true`/`false` case-insensitively, number fields get `Number()`-coerced, array fields (`allowedWritePaths`) split on commas, everything else (including enums) passes through as a string and lets the field's own `.safeParse()` do the real validation. This means adding a new config field to `schema.js` in the future doesn't require also updating a separate "how do I parse this key" table — the schema itself is the only source of truth for both validation and (implicitly) coercion strategy.

## Which fields get a menu entry, and which get redirected

`REDIRECTS` (in `setConfigValue.js`) explicitly names `provider`, `model`, `apiKeyEnvVar`, `providers`, and `adminSystemPrompt` — these already have dedicated commands (`codeagent use`, `codeagent setup`, `codeagent system-prompt set`) and `config set`/the interactive menu refuse to touch them directly, pointing at the right command instead of offering a second, less-safe path to the same state. Every other field in the schema is fair game via `config set <key> <value>` even if it's not one of the ~8 fields `INTERACTIVE_CONFIG_FIELDS` surfaces in the menu by default (e.g. `ollamaBaseUrl`, `maxTokenBudgetPerSession`) — the menu is a curated subset for discoverability, not the ceiling of what `config set` can reach.

## A real bug this surfaced, and the fix

Building `config validate` exposed a genuine pre-existing crash: `run()`'s first-run-setup detection (`shouldRunFirstTimeSetup()`) decides "not configured" purely from whether `~/.codeagentrc` has a `providers` key — a corrupted config file that happens to also be missing (or has an invalid) `providers` key looked like "first run" too, and the unguarded `loadConfig()` call inside that branch threw an uncaught `ConfigError` with a raw stack trace, before any command — including `config validate`, whose entire purpose is handling exactly this — ever got a chance to run. Fixed by wrapping that specific call in a try/catch and pointing the user at `config validate`/`setup`, same friendly-error pattern every other `loadConfig()` call site in the CLI already uses. Covered by a regression test (`test/cli/run.test.js`) rather than only the manual reproduction that found it.

## Testing interactive readline flows: real streams, not subprocess piping

`test/cli/configManager.test.js` drip-feeds input lines through a real `Readable` stream with a small delay between each (`setTimeout`), rather than bulk-piping a fixed string via a subprocess (`printf "..." | node cli.js ...`). The latter looks correct but is genuinely unreliable for multi-`question()` flows — readline's interaction with a pipe that closes immediately after all bytes are written doesn't reliably match how a real terminal delivers keystrokes over time, and bulk-piping is exactly what silently produced a false negative during manual testing of this feature (the flow appeared to "just stop" after one answer, when the actual code was fine). Injecting a real stream via `readline.createInterface({ input, output })` — the same technique `setup.e2e.test.js` already established for the setup wizard — is the reliable way to test this class of interactive CLI code.

## What this doesn't do (v1)

- **No project-level (`.codeagent/config.json`) editing** — `config set`/the interactive menu only write to `~/.codeagentrc` (global), consistent with `codeagent setup`/`codeagent use`/`codeagent system-prompt set` already being global-only. Editing project config remains a manual `.codeagent/config.json` edit, validated afterward via `codeagent config validate` (which does check the full merged resolution, project config included).
- **No undo/history for config changes** — each `config set` or interactive edit is an immediate, permanent write, same as hand-editing the file directly. No dedicated rollback mechanism beyond whatever version control the user's dotfiles are under.
