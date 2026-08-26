import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UsageTracker, estimateCost, PRICING_TABLE } from "../../src/utils/usageTracker.js";

describe("estimateCost", () => {
  it("returns 0 for ollama regardless of model, since it's local inference", () => {
    expect(estimateCost("ollama", "llama3.1", 1_000_000, 1_000_000)).toBe(0);
  });

  it("returns null for a provider/model not in the pricing table", () => {
    expect(estimateCost("openrouter", "some/random-model", 1000, 1000)).toBeNull();
  });

  it("computes cost correctly for a known provider/model", () => {
    // anthropic claude-sonnet-4-6: $3/M input, $15/M output
    const cost = estimateCost("anthropic", "claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 5);
  });

  it("scales linearly with token count", () => {
    const half = estimateCost("anthropic", "claude-sonnet-4-6", 500_000, 500_000);
    const full = estimateCost("anthropic", "claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(half).toBeCloseTo(full / 2, 5);
  });

  it("has at least one model priced for every provider except ollama and openrouter (deliberately unpriced)", () => {
    for (const provider of ["anthropic", "mistral", "groq", "cerebras"]) {
      expect(Object.keys(PRICING_TABLE[provider]).length).toBeGreaterThan(0);
    }
  });
});

describe("UsageTracker", () => {
  let homedir;
  let tracker;

  beforeEach(() => {
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-usage-"));
    tracker = new UsageTracker({ homedir });
  });

  afterEach(() => {
    fs.rmSync(homedir, { recursive: true, force: true });
  });

  it("recordUsage appends a record and getCosts (range: all) sees it", async () => {
    await tracker.recordUsage({ projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 });
    const { breakdown } = await tracker.getCosts({ range: "all" });
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toMatchObject({ provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50, calls: 1 });
  });

  it("aggregates multiple calls to the same provider/model into one breakdown entry", async () => {
    await tracker.recordUsage({ projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 });
    await tracker.recordUsage({ projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 200, outputTokens: 75 });
    const { breakdown } = await tracker.getCosts({ range: "all" });
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toMatchObject({ inputTokens: 300, outputTokens: 125, calls: 2 });
  });

  it("keeps separate breakdown entries for different providers/models", async () => {
    await tracker.recordUsage({ projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 });
    await tracker.recordUsage({ projectRoot: "/p", provider: "groq", model: "llama-3.3-70b-versatile", inputTokens: 100, outputTokens: 50 });
    const { breakdown } = await tracker.getCosts({ range: "all" });
    expect(breakdown).toHaveLength(2);
  });

  it("getCosts totalEstimatedCostUSD sums only priced entries, and hasUnknownCost flags the rest", async () => {
    await tracker.recordUsage({ projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 0 });
    await tracker.recordUsage({ projectRoot: "/p", provider: "openrouter", model: "unknown/model", inputTokens: 1000, outputTokens: 1000 });
    const result = await tracker.getCosts({ range: "all" });
    expect(result.totalEstimatedCostUSD).toBeCloseTo(3, 5); // only the anthropic call is priced
    expect(result.hasUnknownCost).toBe(true);
    expect(result.pricingAsOf).toBeTruthy();
  });

  it("filters by projectRoot when given", async () => {
    await tracker.recordUsage({ projectRoot: "/a", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 });
    await tracker.recordUsage({ projectRoot: "/b", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 });
    const { breakdown } = await tracker.getCosts({ range: "all", projectRoot: "/a" });
    expect(breakdown[0].calls).toBe(1);
  });

  it("filters out records outside the requested range", async () => {
    // Manually inject an old record by writing the log file directly.
    const usageDir = path.join(homedir, ".codeagent", "usage");
    fs.mkdirSync(usageDir, { recursive: true });
    const oldRecord = { timestamp: "2020-01-01T00:00:00.000Z", projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 };
    fs.writeFileSync(path.join(usageDir, "log.jsonl"), JSON.stringify(oldRecord) + "\n");

    const monthResult = await tracker.getCosts({ range: "month" });
    expect(monthResult.breakdown).toHaveLength(0);

    const allResult = await tracker.getCosts({ range: "all" });
    expect(allResult.breakdown).toHaveLength(1);
  });

  it("returns an empty breakdown when there's no log file yet", async () => {
    const result = await tracker.getCosts({ range: "all" });
    expect(result.breakdown).toEqual([]);
    expect(result.totalEstimatedCostUSD).toBe(0);
  });

  it("skips a corrupted line in the log without losing the other lines", async () => {
    const usageDir = path.join(homedir, ".codeagent", "usage");
    fs.mkdirSync(usageDir, { recursive: true });
    const goodRecord = { timestamp: new Date().toISOString(), projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 10, outputTokens: 5 };
    fs.writeFileSync(path.join(usageDir, "log.jsonl"), "not valid json\n" + JSON.stringify(goodRecord) + "\n");
    const result = await tracker.getCosts({ range: "all" });
    expect(result.breakdown).toHaveLength(1);
  });

  describe("quotas", () => {
    it("checkQuota returns null when no quota is set for the provider", async () => {
      expect(await tracker.checkQuota("anthropic")).toBeNull();
    });

    it("setQuota then checkQuota reports overQuota: false when under the limit", async () => {
      await tracker.setQuota("anthropic", 100);
      await tracker.recordUsage({ projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 1000, outputTokens: 1000 });
      const status = await tracker.checkQuota("anthropic");
      expect(status.overQuota).toBe(false);
      expect(status.limit).toBe(100);
    });

    it("reports overQuota: true once spend reaches or exceeds the limit", async () => {
      await tracker.setQuota("anthropic", 1); // $1 limit
      // 1M output tokens at $15/M = way past $1
      await tracker.recordUsage({ projectRoot: "/p", provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 0, outputTokens: 1_000_000 });
      const status = await tracker.checkQuota("anthropic");
      expect(status.overQuota).toBe(true);
    });

    it("setQuota persists across separate UsageTracker instances pointed at the same homedir", async () => {
      await tracker.setQuota("groq", 5);
      const other = new UsageTracker({ homedir });
      expect((await other.getQuotas()).groq).toBe(5);
    });

    it("setQuota for one provider doesn't clobber a previously-set quota for another", async () => {
      await tracker.setQuota("anthropic", 10);
      await tracker.setQuota("groq", 5);
      const quotas = await tracker.getQuotas();
      expect(quotas).toEqual({ anthropic: 10, groq: 5 });
    });
  });
});
