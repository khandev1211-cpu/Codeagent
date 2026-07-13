import { describe, it, expect, vi, afterEach } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic.js";
import { ProviderError } from "../../src/utils/errors.js";

const quietLogger = { warn: () => {}, debug: () => {} };
const ENV_VAR = "CODEAGENT_TEST_ANTHROPIC_KEY";

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

async function* fakeSseBody(events) {
  const encoder = new TextEncoder();
  for (const evt of events) {
    yield encoder.encode(`data: ${JSON.stringify(evt)}\n\n`);
  }
  yield encoder.encode("data: [DONE]\n\n");
}

function makeProvider(fetchImpl) {
  return new AnthropicProvider(
    { apiKeyEnvVar: ENV_VAR, model: "claude-sonnet-5" },
    { fetchImpl, logger: quietLogger }
  );
}

describe("AnthropicProvider.send", () => {
  afterEach(() => {
    delete process.env[ENV_VAR];
    vi.useRealTimers();
  });

  it("sends the correct request shape and parses a successful response", async () => {
    process.env[ENV_VAR] = "sk-test";
    let capturedUrl, capturedInit;
    const fetchImpl = vi.fn(async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse({
        content: [{ type: "text", text: "hi" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: "end_turn",
      });
    });
    const provider = makeProvider(fetchImpl);

    const result = await provider.send([{ role: "user", content: "hello" }], [{ name: "write_file" }]);

    expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
    expect(capturedInit.headers["x-api-key"]).toBe("sk-test");
    const body = JSON.parse(capturedInit.body);
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.stream).toBeUndefined(); // send() must not set stream: true — that's stream()'s job

    expect(result.content).toEqual([{ type: "text", text: "hi" }]);
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.stopReason).toBe("end_turn");
  });

  it("throws a ProviderError with a helpful message when no API key is available", async () => {
    delete process.env[ENV_VAR];
    const fetchImpl = vi.fn();
    const provider = makeProvider(fetchImpl);

    await expect(provider.send([], [])).rejects.toThrow(ProviderError);
    await expect(provider.send([], [])).rejects.toThrow(/codeagent setup/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws on a non-retryable error status without retrying", async () => {
    process.env[ENV_VAR] = "sk-test";
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "bad request" }, { status: 400 }));
    const provider = makeProvider(fetchImpl);

    await expect(provider.send([], [])).rejects.toThrow(ProviderError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries on a 5xx and succeeds once the server recovers", async () => {
    vi.useFakeTimers();
    process.env[ENV_VAR] = "sk-test";
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, { status: 503 });
      return jsonResponse({
        content: [{ type: "text", text: "recovered" }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: "end_turn",
      });
    });
    const provider = makeProvider(fetchImpl);

    const promise = provider.send([], []);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(calls).toBe(2);
    expect(result.content[0].text).toBe("recovered");
  });

  it("throws after exhausting retries on persistent 5xx errors", async () => {
    vi.useFakeTimers();
    process.env[ENV_VAR] = "sk-test";
    const fetchImpl = vi.fn(async () => jsonResponse({}, { status: 503 }));
    const provider = makeProvider(fetchImpl);

    const promise = provider.send([], []);
    const assertion = expect(promise).rejects.toThrow(ProviderError);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});

describe("AnthropicProvider.stream", () => {
  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  it("sets stream: true in the request body (regression: this was accidentally dropped once)", async () => {
    process.env[ENV_VAR] = "sk-test";
    let capturedBody;
    const fetchImpl = vi.fn(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return { ok: true, status: 200, body: fakeSseBody([]) };
    });
    const provider = makeProvider(fetchImpl);

    const gen = provider.stream([{ role: "user", content: "hi" }], []);
    for await (const _ of gen) {
      // drain
    }

    expect(capturedBody.stream).toBe(true);
    expect(capturedBody.model).toBe("claude-sonnet-5");
    expect(capturedBody.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("yields text_delta events and returns final content/usage/stopReason", async () => {
    process.env[ENV_VAR] = "sk-test";
    const events = [
      { type: "message_start", message: { usage: { input_tokens: 7 } } },
      { type: "content_block_delta", delta: { text: "Hel" } },
      { type: "content_block_delta", delta: { text: "lo" } },
      { type: "message_delta", usage: { output_tokens: 3 } },
      { type: "message_stop", stop_reason: "end_turn" },
    ];
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, body: fakeSseBody(events) }));
    const provider = makeProvider(fetchImpl);

    const deltas = [];
    let final;
    const gen = provider.stream([], []);
    let next = await gen.next();
    while (!next.done) {
      deltas.push(next.value);
      next = await gen.next();
    }
    final = next.value;

    expect(deltas).toEqual([
      { type: "text_delta", text: "Hel" },
      { type: "text_delta", text: "lo" },
    ]);
    expect(final.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
    expect(final.stopReason).toBe("end_turn");
  });

  it("throws a ProviderError with no request made when no API key is available", async () => {
    delete process.env[ENV_VAR];
    const fetchImpl = vi.fn();
    const provider = makeProvider(fetchImpl);

    const gen = provider.stream([], []);
    await expect(gen.next()).rejects.toThrow(ProviderError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws a ProviderError when the response is not ok", async () => {
    process.env[ENV_VAR] = "sk-test";
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => "boom" }));
    const provider = makeProvider(fetchImpl);

    const gen = provider.stream([], []);
    await expect(gen.next()).rejects.toThrow(ProviderError);
  });
});

describe("AnthropicProvider.countTokens", () => {
  it("returns a positive estimate that scales with input size", () => {
    const provider = makeProvider(vi.fn());
    const small = provider.countTokens([{ role: "user", content: "hi" }]);
    const large = provider.countTokens([{ role: "user", content: "hi ".repeat(500) }]);
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });
});
