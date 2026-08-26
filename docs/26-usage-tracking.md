# 26 — Usage / Cost Tracking

Phase 9.1 of `PLAN.md`'s Tier 2 — the first Tier 2 item, chosen first specifically because it's independent of everything else in Tier 2 (no dependency on the config-manager or TUI-polish items) and directly useful the moment it exists.

## Aggregation, not new instrumentation

Every provider adapter already returns `{inputTokens, outputTokens}` per call (`docs/06`), and `Orchestrator.runTurn()` already accumulates those into a per-turn `usage` total (used, before this, only internally and by Subagents' `docs/22`). Usage tracking adds nothing to the provider layer — it's one new call, `recordTurnUsage()`, made at the exact point every CLI entry point already had (`docs/24`'s three entry points: `cli/index.js`'s one-shot path, `repl.js`'s loop, `App.js`'s `handleSubmit`) right after a turn completes successfully.

## Storage: global, JSONL, same shape SessionStore already uses

`~/.codeagent/usage/log.jsonl` — global, not project-scoped, deliberately mirroring `SessionStore`'s actual storage shape (`docs/08`): `SessionStore` also stores everything under `~/.codeagent/sessions/`, filtered by a `projectRoot` field on each record, rather than one directory per project. The same shape here means "total spend across every project this month" is a single read, and "spend for just this project" is the same read with a filter — not two different storage designs for two different questions.

JSONL (one JSON record per line, append-only) rather than a single JSON file, specifically because it's safe under concurrent sessions: two codeagent processes writing to the same file at once can each safely `appendFile` a line without racing on a read-modify-write cycle the way a single JSON array file would. A corrupted or partial line (e.g. from a process killed mid-write) is skipped when reading, not treated as a fatal error for the whole log — same "one broken X doesn't take down the rest" principle used everywhere else in this codebase (Skills, Subagents, Slash Commands, MCP server connections).

## Cost is an estimate, treated as one everywhere

`PRICING_TABLE` (`src/utils/usageTracker.js`) is a hardcoded $/million-token table with an explicit `PRICING_AS_OF` date — pricing **will** drift out of date, and every surface that shows a dollar figure (`getCosts()`'s return value, `codeagent usage`'s output) also surfaces that date, specifically so a stale number is never presented with false precision. Two distinct "we don't have a number" cases are kept visually different rather than collapsed into one:

- **`0`** — genuinely free (`ollama`, local inference by construction).
- **`null`** — unknown; the provider/model isn't in the table (most commonly `openrouter`, which gateways an open-ended, frequently-changing set of models at different prices — hardcoding a subset there would be more misleading than admitting the gap). `hasUnknownCost` on the aggregate result means a renderer can say "at least $X, some usage not priced" instead of silently under-reporting.

## Quotas are advisory, never a hard block

`setQuota`/`checkQuota` exist to warn, not to stop a request. Nothing in the orchestrator or provider dispatch path consults a quota before making a call — `recordTurnUsage()` is called *after* a turn already completed, and a quota breach only ever produces a message in the next response, never a refusal. This is deliberate: a hard block on an *estimate* — built on a pricing table that goes stale, checked against a calendar-month cutoff a single long turn could straddle, silent for any unpriced model — risks stopping real work over a number that was never actually a bill. If a harder enforcement mechanism is ever wanted, it should be a new, explicitly-named feature with its own design tradeoffs, not a quiet strengthening of what quotas already mean here.

## CLI surface

- `codeagent usage` (default: this month) / `--today` / `--week` / `--all` — per-provider/model breakdown (calls, tokens, estimated cost) plus a total and the pricing date.
- `codeagent quota` — shows every configured quota's current status.
- `codeagent quota set <provider> <limitUSD>` — sets or updates one provider's monthly limit.

## What this doesn't do (v1)

- **No hard spend limits** — see "advisory, never a hard block" above.
- **No per-model quotas** — quotas are per-provider only; a provider offering several models shares one limit. Splitting further is a real possible refinement, not built now on spec.
- **No cost breakdown by project in the CLI output** — `getCosts({ projectRoot })` supports filtering to one project, but no CLI flag exposes it yet; the global, cross-project view was judged the more immediately useful default.
- **No currency other than USD**, and no live pricing lookup (e.g. querying a provider's own pricing API) — a static table with a visible "as of" date was judged simpler and more honest about its own staleness than either alternative.
