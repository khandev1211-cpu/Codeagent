# 12 — Testing & Quality Assurance

## Test framework and layout

`vitest`, ESM-native, matching the project's module system. `test/` mirrors `src/`'s structure exactly — every module gets a corresponding test file, so coverage gaps are visually obvious from the directory listing alone.

## Strategy per layer

| Layer | What's tested | How |
|---|---|---|
| Tools (doc 05) | Each `execute()` in isolation | Direct unit calls with a temp directory fixture, no orchestrator involved |
| Agent Core (doc 04) | The loop's control flow: iteration limits, error handling, branching on tool_use vs plain text | Fake Provider + fake tools, so loop logic is tested independently of any real API or real filesystem |
| Provider Layer (doc 06) | Request/response translation correctness | Recorded/mocked HTTP responses — never live API calls in the standard test suite, to keep tests fast, free, and deterministic |
| Safety Layer (doc 07) | Destructive calls are always gated absent confirmation/`--yolo`; decline path produces a usable tool_result; path/command boundaries hold | Fake tools with both `destructive: true/false`, asserting the gate behaves correctly in both cases |
| Session (doc 08) | Persistence round-trips correctly; Diff Tracker records match actual file changes; undo reverts correctly | Temp directory fixtures, real file I/O against throwaway paths |
| Config (doc 09) | Layering precedence; schema validation failures produce clear errors; missing API key fails fast | Fixture config files at each layer, asserting merge order |
| CLI/REPL (doc 10) | Argument parsing produces correct resolved options; exit codes match documented behavior for one-shot mode | Direct calls into `src/cli/index.js`, not subprocess spawning, for speed |

## Integration tests

A smaller set of true end-to-end tests exercise the full loop (CLI → Agent Core → fake Provider → real tools against a temp project fixture) to catch issues that unit tests of individual layers wouldn't — e.g. confirming the Safety Layer is actually wired into the real tool execution path, not just tested in isolation. These are intentionally few in number and slower to run, kept separate from the fast unit suite so the common `npm test` loop stays quick during development.

## What is explicitly not tested against the live Anthropic API

Standard CI and local `npm test` runs never make real API calls — this keeps the suite free, fast, and not dependent on external availability or a valid key being present in the test environment. A small, separate, manually-triggered "live smoke test" (not part of `prepublishOnly`, doc 13) can exist for occasionally verifying the real Anthropic adapter against the actual API before a release, but it's explicitly opt-in, not part of the automated gate.

## CI gates (GitHub Actions)

- Lint (`eslint`) must pass.
- Full test suite must pass on the minimum supported Node version (matching `engines` in `package.json`, doc 03) and at least one current LTS version.
- `prepublishOnly` (doc 03) ties lint + test directly to the publish step, so a broken build cannot be published even if CI is somehow bypassed locally.

## Manual QA checklist before a release

Beyond automated tests, a short manual pass before tagging a release (doc 13 covers the full release process):
- Fresh `npm install -g` (or `npx`) from a clean environment actually works.
- A real multi-file task against a real small test project completes correctly with confirmations behaving as expected.
- `--yolo` completes an unattended run correctly in a throwaway project.
- `undo` correctly reverts a real destructive change.
- `--resume` correctly picks up a session after a deliberate kill mid-task.

This manual list exists because some of the most important guarantees (does resuming actually feel right, does the confirmation UX read clearly to a human) are exactly the kind of thing automated tests verify the mechanics of but not the actual experience of.
