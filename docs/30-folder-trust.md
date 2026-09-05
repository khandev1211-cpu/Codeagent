# 30 — Folder Trust (design writeup, not yet implemented)

The gap this closes: codeagent currently starts working in whatever directory it's invoked from immediately — no "do you trust this folder?" gate, unlike VS Code/Cursor/Windsurf's workspace-trust prompt. `allowedWritePaths` (default: project root) already *scopes* what's writable once running, but nothing today asks permission *before* running at all. This doc is the design pass required before touching `cli/index.js`'s entry flow — the same "docs first" discipline every other cross-cutting feature in this project (Hooks, Skills, Subagents, Sandboxing) went through before code.

## What "trust" means here, precisely

A one-time, per-folder consent gate: the *first* time codeagent is invoked with a given directory as its project root, it asks the user to explicitly approve working in that folder — before discovering Skills, Subagents, Hooks, or MCP servers, before building any tool registry, before reading a single project file. Once approved, that folder is remembered (persisted globally, not per-session) and every future invocation in it proceeds without re-asking.

This is a **new, separate gate**, not a replacement for anything that exists:

| Mechanism | Question it answers | When it runs |
|---|---|---|
| **Folder Trust (this doc)** | "Should codeagent operate in this directory *at all*?" | Once, before anything else, first time per folder |
| `allowedWritePaths` (docs/07, /09) | "Which paths can a *write* actually touch?" | Every destructive call, for the whole session |
| Confirmation prompts / `--yolo` (docs/07) | "Should *this specific* destructive call proceed?" | Every destructive tool call |
| Sandbox (`config.sandboxMode`, docs/15) | "Can a `run_bash` command write *outside* the allowlist even if it tries?" | Every `run_bash` call |

Folder Trust sits **before** all of these — it's the outermost gate. A declined folder means none of the others ever get a chance to run.

## Storage: global registry, keyed by realpath

`~/.codeagent/trustedFolders.json` — a flat map: `{ "<realpath>": { trustedAt: "<ISO timestamp>" } }`. Global (not project-scoped, for the obvious reason — a per-project trust file living *inside* the very folder whose trust is in question is a trivially bypassable design: a malicious repo could ship a pre-trusted marker file). Same location convention as `~/.codeagent/sessions/`, `~/.codeagent/usage/` — one home-directory namespace for all of codeagent's cross-project state.

**Realpath, not the raw `cwd` string** — `fs.realpathSync(cwd)` resolves symlinks before checking/storing trust, so a symlink pointing into an already-trusted directory doesn't create a second, separate trust entry, and — more importantly — a symlink crafted to *look* like a path outside a trusted folder but actually resolve inside it doesn't bypass the gate in either direction.

## When the prompt fires

Only for invocations that would actually touch the project — the one-shot CLI (`codeagent "<request>"`) and interactive/TUI sessions (`codeagent` with no argument). It does **not** fire for:

- `codeagent --help`, `codeagent setup`, `codeagent config`, `codeagent providers`, `codeagent use`, `codeagent models` — none of these read or write anything in the current project directory; gating them on folder trust would be asking permission for something that was never going to happen.
- `codeagent skills` / `subagents` / `memory` / `commands` / `mcp` / `hooks` / `permissions` / `sessions` / `usage` / `quota` — these are **read-only discovery/listing** commands. They do read project-local files (`.codeagent/skills/`, `AGENTS.md`, etc.) to list what's configured, which is a real, if narrow, argument for gating them too — but doing so would mean `codeagent skills` on an untrusted folder either silently fails to be useful or forces a trust decision just to *look*, before the user has any information to decide with. Resolved by exempting them in v1: these commands read config files only, never execute anything (no hooks fire, no MCP servers spawn, no tool runs) — same reasoning discovery-command visibility already gets in docs/17/19/22/24/25 ("visibility before any install machinery"). Worth revisiting if this proves to be the wrong call in practice, not asserted as permanently correct.

The gate belongs in `run()` (`src/cli/index.js`), right after argument parsing resolves the target directory and right before `oneShot()`/`interactive()` are called — the same place `shouldRunFirstTimeSetup()`'s check already lives, and conceptually the same kind of gate (a one-time question before proceeding), just answering a different question.

## The prompt itself

```
This folder hasn't been used with codeagent before:
  /home/user/some-project

codeagent will be able to read files here, and — after your
explicit confirmation on each destructive action (see --yolo) —
write files and run shell commands within it.

Trust this folder and continue? (y/n):
```

A "no" answer exits immediately, code 0 (declining isn't an error — it's a valid, respected choice), with a short message pointing at `--trust` (see below) for anyone who wants to skip the prompt deliberately next time, and doesn't touch `trustedFolders.json` at all — so the same folder gets asked again next run rather than being remembered as "explicitly distrusted" (v1 scope: no persisted-decline state; see "what this doesn't do").

## Bypass for automation: `--trust`

A CLI flag, `codeagent --trust "<request>"`, records trust for the current directory (if not already trusted) and proceeds without prompting — for CI, scripts, and Docker images where no human is present to answer a prompt. Deliberately a **different flag from `--yolo`**: trusting a folder ("is it okay for codeagent to operate here at all") and bypassing per-action confirmation ("should this specific write/command proceed") are different questions with different blast radii, and collapsing them into one flag would mean anyone reaching for `--yolo` for its actual purpose (skip confirmation spam in a folder they already trust) accidentally also silently grants trust to folders they never explicitly approved. `--trust` and `--yolo` compose independently and are commonly used together in CI, but are two separate, separately-reasoned-about opt-ins.

## Management: `codeagent trust`

Mirrors the visibility-first pattern every other registry in this project uses (`codeagent skills`, `codeagent hooks`, ...):

- `codeagent trust list` — every trusted folder, with its trusted-at timestamp.
- `codeagent trust revoke <path>` — removes one entry; the next invocation in that folder re-prompts.
- `codeagent trust revoke --all` — clears the whole registry.

No `codeagent trust add <path>` command in v1 — the only way to *grant* trust is either answering "y" at the real prompt or `--trust` on an actual invocation, deliberately: a bare "add" command would let trust be granted for a folder without codeagent ever having been run there, and without the person granting it necessarily being physically at that machine's terminal at the time, which undercuts the whole point of the gate (a considered decision made in the moment of actually starting to work somewhere).

## What this doesn't do (v1)

- **No persisted "distrust."** Declining doesn't write anything — the same folder is asked again next time, not remembered as blocked. A dedicated deny-list is a reasonable future addition if declined-then-retried-anyway turns out to be a real pattern, but isn't built speculatively now.
- **No trust inheritance between parent/child directories.** Trusting `/home/user/projects` does not automatically trust `/home/user/projects/subproject` — each is checked (and, if needed, prompted for) by its own realpath. This matches VS Code's per-workspace trust model rather than inventing a hierarchy-aware one, and avoids a real footgun: a single top-level "trust everything under here" grant would silently cover folders that didn't exist yet at grant time (e.g. someone else's repo cloned into a trusted parent directory later).
- **No expiry.** A trusted folder stays trusted indefinitely until explicitly revoked — no "trust expires after 30 days" mechanism. Worth reconsidering if this tool is ever used in shared/multi-tenant environments, not needed for the single-user local-CLI case this targets today.
- **No integration with `.codeagent/` config files as a trust signal.** The presence of a `.codeagent/hooks.json`/`mcp.json`/etc. in a folder does not affect whether that folder needs trusting — if anything, a folder that already defines hooks/MCP servers is exactly the case where the trust gate matters *most*, since those files can execute code automatically once the session starts. Trust is checked and settled first, entirely independent of what the folder happens to contain.
