import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Global storage (`~/.codeagent/usage/`), same pattern SessionStore
 * already uses (`docs/08`): SessionStore's directory is global too
 * (`~/.codeagent/sessions/`), filtered by a `projectRoot` field on each
 * record, not one directory per project. Usage tracking follows the same
 * shape deliberately — a person's total spend across every project they
 * use codeagent on is at least as useful to see as one project's spend,
 * and a single global log makes "total spend this month" a single read
 * instead of a scan across every project's own storage location.
 */
function usageDir(homedir = os.homedir()) {
  return path.join(homedir, ".codeagent", "usage");
}

function logPath(homedir) {
  return path.join(usageDir(homedir), "log.jsonl");
}

function quotasPath(homedir) {
  return path.join(usageDir(homedir), "quotas.json");
}

/**
 * Approximate list-price $/million-tokens, as of a fixed date — pricing
 * WILL drift out of date; every consumer of this table (getCosts, the
 * `codeagent usage` command) surfaces `pricingAsOf` alongside any dollar
 * figure specifically so the output never presents a stale estimate with
 * false precision. `ollama` is intentionally absent (local inference,
 * $0 by construction, handled as a special case in estimateCost rather
 * than an entry that could go stale). `openrouter` is intentionally
 * empty — it gateways an open-ended, frequently-changing set of models
 * at different prices; hardcoding a subset would be more misleading than
 * just reporting "cost unknown" for it, same reasoning as any other
 * model missing from this table.
 */
export const PRICING_AS_OF = "2026-08-01";
export const PRICING_TABLE = {
  anthropic: {
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-opus-4-8": { input: 15, output: 75 },
    "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  },
  mistral: {
    "codestral-latest": { input: 0.3, output: 0.9 },
  },
  groq: {
    "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  },
  cerebras: {
    "llama-3.3-70b": { input: 0.85, output: 1.2 },
  },
};

/**
 * Returns a dollar estimate, or `null` when the provider/model isn't in
 * `PRICING_TABLE` — `null` is a distinct, meaningful value from `0`
 * here: `0` means "genuinely free" (ollama), `null` means "unknown, we
 * are not going to guess." Callers must keep these two cases visually
 * distinct rather than treating a missing price as zero cost.
 */
export function estimateCost(provider, model, inputTokens, outputTokens) {
  if (provider === "ollama") return 0;
  const rate = PRICING_TABLE[provider]?.[model];
  if (!rate) return null;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

function withinRange(record, range, now) {
  const ts = new Date(record.timestamp);
  if (range === "all") return true;
  if (range === "today") return ts.toDateString() === now.toDateString();
  if (range === "week") return ts >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "month") return ts.getFullYear() === now.getFullYear() && ts.getMonth() === now.getMonth();
  return true;
}

/**
 * Records one line per completed turn to an append-only JSONL log —
 * chosen specifically because it's the simplest format that's safe under
 * concurrent sessions (two codeagent processes appending at once can't
 * corrupt each other's records the way a single read-modify-write JSON
 * file could), and every provider adapter already returns exactly the
 * `{inputTokens, outputTokens}` shape a record needs (`docs/06`) — this
 * is aggregation over data that already exists, not new instrumentation
 * added to the provider layer.
 */
export class UsageTracker {
  constructor({ homedir = os.homedir() } = {}) {
    this.homedir = homedir;
  }

  async recordUsage({ projectRoot, provider, model, inputTokens, outputTokens }) {
    await fs.mkdir(usageDir(this.homedir), { recursive: true });
    const record = {
      timestamp: new Date().toISOString(),
      projectRoot,
      provider,
      model,
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
    };
    await fs.appendFile(logPath(this.homedir), JSON.stringify(record) + "\n", "utf-8");
    return record;
  }

  async _readLog() {
    try {
      const raw = await fs.readFile(logPath(this.homedir), "utf-8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            // One corrupted line (e.g. a partial write from a killed
            // process) must not make every other line unreadable —
            // same "one broken X doesn't take down the rest" principle
            // used throughout (Skills, Subagents, MCP server connections).
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Aggregates by provider+model within `range` ("today" | "week" |
   * "month" | "all", default "month"), optionally further filtered to
   * one `projectRoot`. Every breakdown entry carries its own
   * `estimatedCostUSD` (possibly `null`) rather than the caller having
   * to re-derive it, and the top-level `hasUnknownCost` flag means a
   * renderer can show "at least $X (some usage not priced)" instead of
   * silently under-reporting a total that excludes unpriced models.
   */
  async getCosts({ range = "month", projectRoot } = {}) {
    const now = new Date();
    const records = (await this._readLog()).filter(
      (r) => withinRange(r, range, now) && (!projectRoot || r.projectRoot === projectRoot)
    );

    const byProviderModel = new Map();
    for (const r of records) {
      const key = `${r.provider}/${r.model}`;
      if (!byProviderModel.has(key)) {
        byProviderModel.set(key, { provider: r.provider, model: r.model, inputTokens: 0, outputTokens: 0, calls: 0 });
      }
      const agg = byProviderModel.get(key);
      agg.inputTokens += r.inputTokens;
      agg.outputTokens += r.outputTokens;
      agg.calls += 1;
    }

    const breakdown = Array.from(byProviderModel.values()).map((agg) => ({
      ...agg,
      estimatedCostUSD: estimateCost(agg.provider, agg.model, agg.inputTokens, agg.outputTokens),
    }));

    return {
      range,
      breakdown,
      totalEstimatedCostUSD: breakdown.reduce((sum, b) => sum + (b.estimatedCostUSD || 0), 0),
      hasUnknownCost: breakdown.some((b) => b.estimatedCostUSD === null),
      pricingAsOf: PRICING_AS_OF,
    };
  }

  async getQuotas() {
    try {
      return JSON.parse(await fs.readFile(quotasPath(this.homedir), "utf-8"));
    } catch {
      return {};
    }
  }

  async setQuota(provider, limitUSD) {
    await fs.mkdir(usageDir(this.homedir), { recursive: true });
    const quotas = await this.getQuotas();
    quotas[provider] = limitUSD;
    await fs.writeFile(quotasPath(this.homedir), JSON.stringify(quotas, null, 2), "utf-8");
    return quotas;
  }

  /**
   * Compares this calendar month's estimated spend for `provider`
   * against its configured quota. Returns `null` when no quota is set —
   * distinct from `{overQuota: false, ...}`, so a caller can tell
   * "nothing to check" from "checked and fine" without an extra flag.
   * Deliberately advisory only: nothing calls this to block a request —
   * a hard block on an *estimate* (unpriced models exist, pricing drifts,
   * quotas are calendar-month cutoffs a mid-turn call could straddle)
   * risks stopping legitimate work over a number that was never a bill.
   */
  async checkQuota(provider) {
    const quotas = await this.getQuotas();
    const limit = quotas[provider];
    if (limit === undefined) return null;
    const { breakdown } = await this.getCosts({ range: "month" });
    const spent = breakdown
      .filter((b) => b.provider === provider)
      .reduce((sum, b) => sum + (b.estimatedCostUSD || 0), 0);
    return { provider, limit, spent, overQuota: spent >= limit };
  }
}

/**
 * The one call every CLI entry point (one-shot `cli/index.js`, `repl.js`'s
 * loop, `App.js`'s `handleSubmit`) makes after a turn completes —
 * records the turn's usage, then checks the quota for that provider.
 * Deliberately UI-agnostic (returns the quota status, doesn't render
 * anything) since the three entry points render warnings differently
 * (plain stdout, REPL prompt, React `appendEntry`) — same reasoning
 * `resolveSlashCommand` stays pure and lets callers own execution
 * (`docs/24`).
 */
export async function recordTurnUsage({ usageTracker, cwd, config, usage }) {
  if (!usage) return null;
  await usageTracker.recordUsage({
    projectRoot: cwd,
    provider: config.provider,
    model: config.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return usageTracker.checkQuota(config.provider);
}
