# 18 — Provider Management, Shared History, and the Admin System Prompt

## Principle

First run asks; every run after that just works. That's the whole design goal here, matching how Claude Code's own onboarding behaves: `codeagent setup` collects what it needs once, persists it, and gets out of the way. Before this doc, "persists it" wasn't actually true — see below.

## The bug this replaces

`codeagent setup` used to walk through the whole wizard, print "✨ Setup complete!", and then throw away everything it collected. `runSetupWizard()` returned `{ provider, model, apiKeyEnvVar }`, and the CLI action that called it discarded the return value — nothing was ever written to disk. A grep of the entire `src/config/` and `src/cli/` trees turned up zero file-write calls anywhere in the config path. Separately, `codeagent setup`'s optional "save to keychain" step was write-only: `KeychainManager.getKey()` existed but nothing ever called it at runtime, so even a successful keychain save didn't survive to the next `codeagent` invocation. Both are fixed here; the fixes are described below because they're foundational to everything else in this doc.

## Config shape (`~/.codeagentrc`)

```json
{
  "provider": "mistral",
  "model": "codestral-latest",
  "apiKeyEnvVar": "MISTRAL_API_KEY",
  "adminSystemPrompt": "Always write TypeScript, never JavaScript.",
  "providers": {
    "anthropic": { "apiKeyEnvVar": "ANTHROPIC_API_KEY", "model": "claude-sonnet-5", "useKeychain": true },
    "mistral": { "apiKeyEnvVar": "MISTRAL_API_KEY", "model": "codestral-latest", "useKeychain": false }
  }
}
```

`provider`/`model`/`apiKeyEnvVar` at the top level are "the active selection" — exactly what every existing part of the codebase already read before this change, so nothing about the resolved-config shape broke. `providers` is new: every provider ever configured, active or not. This is what makes "add another provider" possible without redesigning anything downstream (`src/config/loader.js`: `saveGlobalConfig`, `upsertProvider`, `listConfiguredProviders`, `configExists`).

## Setup wizard: first run vs. every run after

`codeagent setup` (`src/cli/setup.js`) checks `listConfiguredProviders()` at the start:

- **Nothing configured yet** → the familiar fresh flow: pick a provider, enter a key (or reuse one already sitting in an env var or the keychain), pick a model, optionally save to the keychain. Persists via `upsertProvider(...)` as soon as each step completes — not via a return value the caller has to remember to save.
- **Something's already configured** → a menu instead: *Add another provider* / *Switch active provider or model* / *Reconfigure a provider's key* / *Done*. "Add another" filters out providers you already have; "reconfigure a key" never changes which provider is active; "switch" does exactly that and nothing else.

## First-run auto-detection

Before this doc, `codeagent setup` had to be run manually — a bare `codeagent` on an unconfigured machine just failed with a missing-env-var error. Now `run(argv)` (`src/cli/index.js`) checks `shouldRunFirstTimeSetup(argv)` before dispatching anything: if no provider has ever been configured and the command isn't `setup` itself (or `--help`/`--version`), it runs the wizard first, then continues with whatever was originally typed. Typing `codeagent "add a login form"` on a fresh machine now setup-then-runs in one motion, the way Claude Code's own first-run experience does.

## Keychain read path (the other half of the original bug)

`src/providers/resolveApiKey.js` is now the single place every provider adapter resolves a key: environment variable first (no shell-out, and an explicit env var should always win), falling back to `KeychainManager.getKey(provider)`. Both `AnthropicProvider._apiKey()` and `OpenAiCompatibleProvider._apiKey()` (covering Mistral/Groq/Cerebras/OpenRouter/Ollama — they all extend it) go through this now, as does the CLI's own boot-time key check. This required making `_apiKey()`/`_headers()` async in both provider files — every call site was already inside an `async` method, so this was a mechanical, low-risk change, verified by the full existing provider-facing test suite plus new tests written alongside it.

One subtlety worth naming: this same boot-time check used to unconditionally require a key for every provider, which would have incorrectly blocked Ollama (which needs no key — `requiresApiKey: false`). Fixed by constructing the provider first and checking its own `requiresApiKey` flag rather than assuming every provider needs one.

## Shared history across a provider switch

This one didn't need new code — it was verified, not built. `session.provider`/`session.model` (`src/session/store.js`) are just metadata recorded at creation time; nothing about resuming a session reads them to pick a provider. `--resume <id> --provider mistral` already hands the exact same `session.messages` array to a completely different provider. The reason this works: every provider adapter translates to and from one common internal message shape (`{type: "text" | "tool_use" | "tool_result", ...}` — `docs/06`), so `session.messages` is provider-agnostic by construction. This was confirmed by taking a realistic session — a user message, a tool call, a tool result, a final reply — through the actual `toOpenAiMessages()`/`fromOpenAiMessage()` translation functions Mistral/Groq/Cerebras/OpenRouter/Ollama all share, and back. Zero data loss either direction.

`codeagent use <provider> [model]` makes switching the *default* active provider a one-line, persistent action instead of requiring `--provider`/`--model` flags every time — but the underlying "same history, different model" capability was already there.

## The admin system prompt

`codeagent system-prompt set "<text>"` / `show` / `clear` manage one standing instruction, stored in `~/.codeagentrc` as `adminSystemPrompt` — global, not per-project (use `customSystemPromptAddendum` in a project's `.codeagent/config.json` for project-specific instructions instead, which still works exactly as before).

**Priority, but not a replacement.** This was a deliberate design decision, not a default: the admin prompt is inserted right after the base tool-use conventions (`src/agent/systemPrompt.js`'s `BASE_TEMPLATE`) and before project context, with explicit framing that it takes priority over everything below it. It does **not** replace the base conventions, and its "priority" has no bearing on the Safety Layer or Hooks at all — those are enforced in code (`safety/confirm.js`, `hooks/registry.js`), completely independent of what any system prompt, admin-set or otherwise, says. An admin prompt telling the agent to skip confirmations would have no actual effect; the confirmation gate doesn't consult the model's instructions.

```
## Standing instructions from the administrator (priority)
Set once via "codeagent setup" or "codeagent system-prompt set", these apply
across every project on this machine and take priority over the project
context and any other instructions below — follow them unless they conflict
with the tool-use conventions above.

<your text>
```

## What this doesn't do

- No per-project admin prompt override — it's deliberately global-only. If that turns out to be a real need, it's additive later, not a redesign.
- No encryption for the local-storage keychain fallback — still permission-restricted (0600) plaintext, same as before this doc; only relevant on platforms with neither a native credential manager nor `pass`.
- No UI for editing `providers` entries beyond the wizard's menu and `codeagent use` — no `codeagent providers remove <name>` yet. Additive if needed.

## Testing this layer

- `test/config/loader.test.js` — `saveGlobalConfig`/`upsertProvider`/`configExists`/`listConfiguredProviders`, including that adding a second provider never silently drops the first.
- `test/cli/setup.e2e.test.js` — the wizard's actual decision logic (which menu branch, what gets persisted) driven end to end with a stubbed prompt, asserting against config *on disk*, not the return value — directly testing the fix for the original bug.
- `test/utils/keychain.test.js` — a real round trip through the local fallback, plus mocked-`execFileSync` tests proving key values are never interpolated into a shell command string (the injection-safety fix), independent of whether `pass`/`security`/`cmdkey` happen to be installed wherever the tests run.
- `test/providers/resolveApiKey.test.js`, `test/providers/anthropic.test.js` — env-var precedence, keychain fallback, and (new) real coverage of `AnthropicProvider.send()`/`.stream()`, including retry/backoff behavior with fake timers.
- `test/agent/systemPrompt.test.js` — the admin prompt's position and framing, including that it appears *after* the base conventions, never before.
