# 28 — TUI Polish: Theming & Vim Keybindings

Tier 2, Phase 9.3 — cosmetic, no other item depends on or is blocked by this. Two independent features sharing one doc since both are `docs/21`'s already-named remaining gaps for the Rich TUI.

## Theming

### Named schemes, not a color picker

`config.theme: "default" | "monochrome" | "high-contrast"` — a small, curated set rather than arbitrary hex customization. Most people want "the default," "something for a limited-color or light-background terminal," or "higher contrast," not a color picker; named colors also degrade gracefully on terminals with fewer than 16.7M colors, where an arbitrary hex value might render unpredictably.

### One semantic palette, not per-component color logic

Every theme (`src/cli/tui/theme.js`) defines the exact same keys — `accent`, `muted`, `success`, `warning`, `error` — so `StatusHeader.js`/`SessionLog.js` read `theme.accent` etc. instead of a hardcoded color string, and switching themes needed zero new branching logic in either component, just replacing literal color strings with the corresponding semantic key. `InputBox.js` (the non-vim default) deliberately keeps its existing hardcoded `"gray"` — it has no semantic distinctions to make (there's only ever one visual state for the border), so threading a theme prop through it would be complexity with no payoff.

### Defaults preserve the exact original palette

`getTheme()` falls back to `"default"` for a missing or unrecognized theme name, and `THEMES.default` is byte-for-byte the palette (`#d97757`, `gray`, `green`, `yellow`) the TUI already shipped with — every existing caller of `StatusHeader`/`SessionLog` that doesn't pass a `theme` prop gets that same default via the parameter default, so this is a purely additive change with no visual difference for anyone not opting into a different theme.

## Vim keybindings

### A genuine subset, not an emulation

`docs/21` already scoped this precisely: "normal/insert-mode-style navigation within the existing inline-render model, not a `vim`/`htop`-style full-screen takeover." `VimInputBox.js` is exactly that — two modes (insert/normal), a handful of commands (`i`/`a`/`I`/`A` to enter insert at different cursor positions, `h`/`l`/`0`/`$` to navigate, `x` to delete a character, `dd` to clear the line). No registers, no visual mode, no `.`-repeat, no counts (`3dd`). This is deliberately a comfort feature for vim users' muscle memory on basic line editing, not a vim clone.

### Enter always submits, regardless of mode

Real vim has no universal "submit" concept, and Enter in normal mode moves down a line. This box is a single-line chat input, not a text editor — "press Enter to send" is what every user of a chat interface already expects, and preserving that expectation matters more here than strict vim fidelity. This is the one deliberate, named deviation from vim semantics in the whole feature.

### A different component, not a mode bolted onto the existing one

`InputBox.js` normally renders `ink-text-input`'s `TextInput`, which manages its own internal cursor state with no way to intercept keys for a second mode. Rather than fighting that library's internals, `config.vimKeybindings: true` swaps the entire rendering path to `VimInputBox` — built directly on ink's own `useInput` hook, owning cursor position and character insertion/deletion itself. When the flag is off (the default), `InputBox.js` renders exactly what it always has — byte-for-byte the same code path, so the default experience is provably unchanged for anyone not opting in.

### One pending-key flag, not a general command parser

`dd` is the only multi-key command in this subset, so it's implemented as a single `pendingD` boolean rather than a general vim-style command-sequence state machine. Building a real parser for one two-key sequence would be solving a problem this minimal feature set doesn't have.

## A real testing lesson from building this

Simulating multi-key interactive sequences against `ink`'s `useInput` needs a real delay between each simulated keystroke (`test/cli/tui/VimInputBox.test.js` uses ~20ms). Writing keys back-to-back synchronously in a test does not reliably reproduce how a real terminal delivers keystrokes over time — verified directly: a bare Escape written immediately before another key can misparse (since Escape also begins several ANSI escape *sequences*, like arrow keys), while the same two writes with a short delay between them correctly resolve as two separate key events. Every multi-key test sequence in this feature's test suite goes through a small `press()` helper that awaits a tick after each write, rather than writing a whole sequence as one string.

A second, related lesson: `VimInputBox` is a controlled component for `value` (only `mode` and cursor position are internal state) — a test that renders it once with a fixed `value` prop and never updates that prop between keystrokes will silently operate every step against the *original* value, not the previously-edited one, since nothing re-renders the component with the new value in between. The test suite's `Harness` component holds `value` in real React state and re-renders on every `onChange`, mirroring exactly how `App.js` actually wires this component up — this is necessary for any multi-step edit test (e.g. "move to start, then delete a character") to mean what it looks like it means.

## What this doesn't do (v1)

- **No arbitrary color customization** — three named themes, not a color picker or hex-value config.
- **No vim keybindings anywhere else in the TUI** (the model switcher, confirmation prompts) — scoped to the text input box only, where the comfort-feature payoff is highest (that's where users spend the most keystrokes).
- **No persistent mode across sessions beyond the config flag itself** — `VimInputBox` always starts in insert mode on mount; there's no "remember I was in normal mode" state carried between messages or sessions (matches real terminal vim's own per-buffer behavior closely enough for this scope).
- **No visual mode, registers, `.`-repeat, or counts** — see "a genuine subset, not an emulation" above.
