# 14 — Support, Maintenance & Roadmap

## Support channels

- **GitHub Issues** (primary channel) — bug reports, feature requests, questions. Templates (see below) keep reports actionable.
- **README** — should always answer the top handful of "how do I..." questions directly (install, first run, `--yolo`, undo, resume) without needing to open an issue at all; a support burden reduced by good docs is cheaper than one handled reactively.
- **CHANGELOG.md** — the first place to check "did this behavior change recently" before filing an issue.

## Issue templates (recommended structure)

**Bug report:**
- codeagent version, Node version, OS
- Command run
- Expected vs. actual behavior
- Relevant session log excerpt if available (with API key redaction reminder, doc 15, in the template itself so reporters don't accidentally paste a key)

**Feature request:**
- What you're trying to do
- Why existing tools/config (doc 05, doc 09) don't cover it
- Whether this fits the "additive extension" model (doc 11) or would need a core change

## Triage process

1. Reproduce, or ask for the minimum info needed to reproduce (using the template above cuts most of this round-trip).
2. Classify: bug (patch-worthy), enhancement (minor-worthy, see doc 13's semver rules), or core-architecture change (needs design discussion before any code, per doc 11's "guiding test" for what counts as a core change).
3. Label with expected release type so contributors and users both know what to expect and when.

## Contribution guide (summary — full `CONTRIBUTING.md` should link back to these docs)

- New tool or provider? Read doc 11 first — most contributions should be additive and won't need to touch the orchestrator, provider interface, or safety policy.
- Any PR touching `src/agent/orchestrator.js`, `src/providers/base.js`, or `src/safety/policy.js` should explain *why* the core contract needed to change, not just what changed — these are treated as high-scrutiny files by design (doc 11).
- All new tools/providers need tests per the patterns in doc 12 before merge.
- `prepublishOnly` (doc 03) will block a broken build regardless, but PRs should pass lint + test locally before review to keep review cycles fast.

## Maintenance cadence

- **Dependency updates:** reviewed on a regular cadence (not just reactively on a security alert), since this project's trust surface (running shell commands, writing files) makes supply-chain hygiene more consequential than for a typical utility package.
- **Security-relevant dependencies specifically:** anything in the request/HTTP path or shell-execution path gets prioritized review on updates over, say, a linting dependency.

## Roadmap (illustrative — not commitments, organized by the extension points they'd use)

| Idea | Uses extension point | Notes |
|---|---|---|
| `run_tests` tool (framework-aware wrapper around `run_bash`) | New tool (doc 11) | Parses test-framework output instead of raw stdout |
| `git_diff` / `git_status` tools | New tool (doc 11) | Cleaner version-control-aware context than raw `run_bash "git diff"` |
| Second LLM provider | New provider (doc 11) | Only once a real second use case justifies it — not speculative |
| Plugin loader for third-party tools | Deferred extension (doc 11) | Explicitly gated on the tool-module shape proving stable first |
| SQLite-backed session store | Swap within Session layer (doc 08) | Only if cross-session querying becomes a real need — JSON is sufficient otherwise |

Each roadmap item is written against a specific extension point so that picking one up later doesn't require re-deriving where it fits in the architecture — that mapping is the point of doc 11 existing at all.
