# Changelog

All notable changes to this project are documented here (Keep a Changelog format).

## [Unreleased]

### Added
- Permission rules & Plan Mode: `.codeagent/permissions.json` defines fine-grained allow/deny rules per tool+pattern (e.g. always allow `npm test*`, always deny writes to `*.env`), checked before the existing confirm/`--yolo` gate — deny always wins when both an allow and a deny rule match. `--plan` makes destructive tools describe what they would do instead of doing it, for the whole session — verified against real tools and real files, not just mocks. New `codeagent permissions` command lists configured rules. See `docs/20`.
- Skills: discoverable `SKILL.md` capabilities under `.codeagent/skills/<name>/SKILL.md`, with progressive disclosure — the system prompt gets a one-line index (name + description) for each skill, never full content; the model reads a specific skill's full instructions on demand via the existing `read_file` tool, only when it decides that skill applies. New `codeagent skills` command lists what's discovered. Two real example skills ship with the project (`commit-message`, `code-review`). `allowed-tools` frontmatter is parsed but still not enforced — permission rules (below) landed, but nothing yet wires them specifically to a skill's `allowed-tools` list. See `docs/19`.
- Hooks: `PreToolUse` and `PostToolUse` lifecycle events, configured via `.codeagent/hooks.json` — a `PreToolUse` hook can block a tool call before it runs (e.g. reject a dangerous shell command), and a `PostToolUse` hook can attach context to the result the model sees (e.g. "formatted with prettier"). `SessionStart`/`SessionEnd` events also fire around the session lifecycle. New `codeagent hooks` command lists what's configured. See `docs/17`.
- Multi-provider management: `codeagent providers` lists every configured provider, which is active, and its key source; `codeagent use <provider> [model]` switches the active provider/model persistently. Session history carries over across a provider switch unchanged.
- First-run setup: running `codeagent` on a machine with no provider configured now walks through setup automatically before your command runs, instead of failing with a missing-env-var error.
- `codeagent setup`, run again after the first time, now offers to add another provider, switch the active one, or reconfigure a key, instead of repeating the fresh-install flow.
- Admin system prompt: `codeagent system-prompt set "<text>"` / `show` / `clear` — a standing instruction that applies across every project on the machine, layered with priority above project-specific context.
- CI: GitHub Actions now lints and runs the full test suite on every push/PR (Node 22.x and 24.x), and a tag-triggered workflow publishes to npm after re-verifying lint/tests and that the tag matches `package.json`'s version.
- New docs: `docs/16` (Claude Code feature-parity audit, driving the project's forward roadmap), `docs/17` (Hooks), `docs/18` (provider management & admin system prompt).

### Fixed
- `.gitignore` blanket-ignored the entire project-level `.codeagent/` directory, silently making `hooks.json` (since Phase 3) and now `skills/` un-shareable via git despite both being explicitly designed to be committed and shared with a team. Real local state (session/undo history) lives in `~/.codeagent/sessions` — the user's home directory, never inside a project's repo — so nothing under a project's `.codeagent/` actually needed excluding.
- `test/e2e/agent-coding.test.js` — rewritten as a genuine end-to-end test. It previously imported a nonexistent default export, mocked the tool registry with a shape that didn't match the real class, and used `require()` inside an ESM module; it had never actually run. Now runs the real `Orchestrator` against the real `ToolRegistry` and real tools (actual file I/O in a temp directory), faking only the LLM response — confirmed via real CI, not just locally.
- `actions/checkout@v4` / `actions/setup-node@v4` bumped to `@v5` in both workflows — v4 still targets the Node 20 runtime GitHub is removing from Actions runners in September 2026; v5 runs natively on Node 24.
- `codeagent setup` used to discard every choice you made the moment the process exited — nothing was ever written to disk. It now persists to `~/.codeagentrc` as each step completes.
- An API key saved to the OS keychain during setup was never actually read back at runtime (`useKeychain: true` had no effect). Every provider now resolves its key from the environment variable first, falling back to the keychain.
- A crash in `codeagent setup`'s hidden API-key input: typing any character would throw `char.charCodeAt is not a function`, because keystrokes arrived as raw `Buffer`s rather than strings. Hidden input now also handles pasted (multi-character) input and falls back to a visible prompt on a non-TTY stdin instead of crashing.
- A shell-injection risk in keychain storage: API keys were previously interpolated into `security`/`pass`/`cmdkey` command strings. Keys are now passed via argument arrays or piped through stdin — never built into a shell command string.
- The stray `<![CDATA[ ... ]]>` wrapper around the entire README that would have rendered broken on GitHub/npm.

### Known issues
- `package.json`'s `engines.node` (`>=18.0.0`) is stale — Node 18 and 20 are both past their upstream end-of-life as of mid-2026. CI now targets 22.x/24.x; bumping the declared minimum is a deliberate follow-up, not done as part of this release.

## [0.1.0] - 2026-07-11

### Added
- Initial implementation of the full architecture described in `docs/`: CLI/REPL, Agent Core loop, Provider Layer (Anthropic + OpenRouter adapters), 6 core tools (`read_file`, `write_file`, `edit_file`, `list_dir`, `search_code`, `run_bash`), Safety Layer with `--yolo` bypass and audit logging, Session Store with resumable sessions and undo, layered Configuration system.
- OpenRouter adapter providing a path to free-tier models, alongside Anthropic as the default provider.
- Test suite (vitest) covering tools, config layering, safety confirmation gate, and the orchestrator loop against a fake provider.
