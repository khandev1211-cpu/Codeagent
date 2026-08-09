# 21 — Rich TUI (Ink-based interactive session)

## Principle

`repl.js`'s plain `readline` loop — one line in, one line out — is unchanged and still the default for anything that isn't a real interactive terminal. This doc covers the second, richer front end: a boxed layout with a live status header and a mid-session model switcher, built on [Ink](https://github.com/vadimdemedes/ink) (React for terminals — the same general approach Claude Code itself uses, per what's publicly known about its architecture). Same underlying session, same `Orchestrator`, same Hooks/Skills/Permission Rules — this changes how the session looks and how you switch models, not what the agent does.

## Why two front ends, not one

Ink needs a real terminal on both ends: raw-mode keyboard capture needs `stdin` to be a TTY, redrawing regions of the screen needs `stdout` to be one. Piped input, CI, and scripted usage don't have either — and codeagent's own stated design goal is "works in CI as well as interactively" (`docs/10`). So `cli/index.js`'s `interactive()` picks between them:

```js
const useTui = process.stdin.isTTY && process.stdout.isTTY && process.env.CODEAGENT_PLAIN_REPL !== "1";
```

`CODEAGENT_PLAIN_REPL=1` is an explicit escape hatch back to the plain REPL even in a real terminal, for anyone who prefers it or hits a terminal-emulator quirk with the richer one. The Ink module is loaded with a dynamic `import()`, not a static one — every one-shot, scripted, or CI invocation of codeagent should never pay the cost of loading React/Ink at all, only sessions that actually reach this branch.

## Components (`src/cli/tui/`)

No JSX, no build step — `bin/cli.js` still runs directly under Node with nothing to transpile (`docs/03`), so every component is written with plain `React.createElement` calls via a one-line `h` alias (`h.js`), the same convention many JSX-free React codebases use.

- **`StatusHeader`** — model, provider, Plan Mode state, skills count, rules count, cwd. Every value is a live read of real state; nothing here is hardcoded, unlike the mock-data mockup this was designed from.
- **`SessionLog`** — renders the conversation as plain data (`{type, ...}` entries), not mutated React state — trivial to test what it renders for a given input independent of how `App` accumulates entries.
- **`InputBox`** — a bordered `ink-text-input` field; shows a "working…" indicator with the input hidden while a turn is in flight.
- **`ModelSwitcher`** — a filterable, keyboard-navigable overlay built from the real configured-providers map (`docs/18`), not a static list.
- **`App`** — owns all the state and glue: constructs the `Orchestrator` once (mirroring `repl.js`'s construction exactly), runs turns, and handles switching.

## The model switcher, and the real bug that shaped it

Original design used Ctrl+K (a common command-palette convention). It doesn't work reliably here, and this was found with a real PTY test, not reasoned out in advance: Ink's `useInput` has no event-consumption or priority mechanism — every active `useInput` hook in the tree receives every keystroke. `ink-text-input`'s own internal handler doesn't special-case Ctrl+K (confirmed by reading its source), so on the exact same keystroke that's meant to open the switcher, the literal character `"k"` also gets appended to whatever's typed in the input box underneath.

The fix is **Tab**, not a workaround around Ctrl+K. `ink-text-input` unconditionally ignores a small set of keys — arrows, Ctrl+C, Tab, Shift+Tab — checked before anything about focus or component state, so it can never leak into typed text regardless of timing. This was verified twice: once as a failing test (`test/cli/tui/App.test.js`, before the fix), then confirmed fixed against a real PTY-spawned process, not just the test double.

Filtering matches a stray case-insensitive substring against `"provider model"` — fine for a list in the tens of configured provider/model combinations, not an attempt at a fuzzy-match command palette.

## `Orchestrator.setProvider()`

Switching providers mid-session needed one small, deliberate addition to `orchestrator.js` — a method, not a caller reaching in and reassigning `.provider` directly, since this is the one place that should own what "the active provider" means for a running session:

```js
orchestrator.setProvider(newProviderInstance, { providerName: "mistral", model: "codestral-latest" });
```

Session history is untouched by this call. That's not new work — it's the same guarantee verified in `docs/18`: every provider adapter speaks the same internal message format, so `session.messages` carries over to whichever provider is active next, unchanged.

## Another real bug this build caught: stale index on rapid keystrokes

`ModelSwitcher`'s arrow-key navigation originally read the currently-selected index from React state captured in the `useInput` closure. A test simulating a down-arrow immediately followed by Enter (no delay — a realistic fast keypress, not an edge case) selected the *first* option instead of the second: two events processed synchronously, in the same tick, before React's state update from the first had committed, so the second handler invocation still saw the old index.

The fix: a `useRef` as the actual source of truth for navigation, mutated synchronously and immediately inside the arrow-key handlers — not derived from render at all. A `useState` value still exists purely to trigger a re-render so the highlighted row visually updates; it's a mirror of the ref, never the thing logic depends on. `useEffect` resets both when the filter text changes (runs after commit, so it can't race with the ref updates the input handler makes).

## Testing this layer

- `test/cli/tui/StatusHeader.test.js`, `SessionLog.test.js`, `InputBox.test.js` — rendering correctness in isolation, via `ink-testing-library`.
- `test/cli/tui/ModelSwitcher.test.js` — navigation, selection, cancellation, filtering, and specifically the same-tick rapid-keystroke case that caught the stale-index bug above.
- `test/cli/tui/App.test.js` — integration-level: submitting a message runs a real turn through a fake provider and the reply appears; Tab opens the switcher; Escape returns without changing anything; **selecting a different provider in the switcher actually routes the next turn through a different fake provider** (mocking `providers/index.js`'s `getProvider`), proving the switch is real, not just a UI state change; a working indicator disables input mid-turn.
- A real PTY-spawned process (not `ink-testing-library`'s simulated stdin) confirmed the actual mounted app renders real configured-provider data in the switcher and that the Tab-keybinding fix genuinely eliminates the character-leak bug in a genuine terminal.

## What this doesn't do

- No mouse support — keyboard only, matching Ink's own primary interaction model.
- No alternate-screen buffer (the `vim`/`htop`-style full-screen takeover) — v1 renders inline; revisit if scrollback behavior becomes a real complaint.
- No mid-turn provider switching — the switcher is disabled while a turn is in flight (`isActive: !switcherOpen && !working`); the next turn after a switch uses the new provider, not the one already running.
- No Plan Mode toggle from the header yet — it's *displayed* (live), not yet *togglable* from the TUI; still `--plan` at launch only (`docs/20`).
