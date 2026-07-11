# 06 — Provider Layer

## Why this layer exists

The Agent Core (doc 04) should never know the specific wire format of any LLM API. Everything it needs — send a conversation, get back text and/or tool calls, know how many tokens were used — is expressed through one interface. This is what makes a second provider (or a local model, later) an additive change rather than a rewrite.

## The interface (`src/providers/base.js`)

```js
class Provider {
  /** Non-streaming call. Returns { content: [...], usage: {...} } */
  async send(messages, tools, opts) {
    throw new Error("not implemented");
  }

  /** Streaming call. Yields chunks as they arrive. */
  async *stream(messages, tools, opts) {
    throw new Error("not implemented");
  }

  /** Estimate token count for a message list, for budget tracking (doc 04). */
  countTokens(messages) {
    throw new Error("not implemented");
  }
}
```

Every adapter implements this same shape. The orchestrator only ever calls `provider.send(...)` / `provider.stream(...)` / `provider.countTokens(...)` — it never branches on "if Anthropic do X, if OpenAI do Y."

## Anthropic adapter (`src/providers/anthropic.js`) — default, v1

- Wraps the `/v1/messages` endpoint.
- Translates the Tool Registry's schema list (doc 05) into the `tools` array Anthropic's API expects.
- Translates Anthropic's response content blocks (`text`, `tool_use`) into the normalized `content` array the interface promises.
- Handles streaming via Anthropic's SSE-based streaming response, re-emitted as the generator shape the interface expects.
- `countTokens` uses Anthropic's token counting, or a local approximation if a dedicated endpoint isn't used, clearly documented as an estimate.

## Provider selection (`src/providers/index.js`)

A small factory that reads the resolved config (doc 09) and returns the right adapter instance:

```js
function getProvider(config) {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    default:
      throw new ConfigError(`Unknown provider: ${config.provider}`);
  }
}
```

Adding a second provider later means adding one `case` here and one new adapter file — nothing else in the codebase changes.

## API key handling

- The provider adapter is the *only* place the API key is read into memory for use in a request.
- Keys are never included in log output at any log level (doc 15) — the logger has an explicit redaction rule for anything matching the provider's key format, as defense in depth beyond just "don't log it."
- Keys are sourced through Config (doc 09) — environment variable first, then config file — never hardcoded, never committed.

## Retry and rate-limit behavior

- Transient errors (5xx, network failures) → retried with exponential backoff, small fixed max attempts (this is provider-adapter-level retry, separate from the orchestrator's own error handling in doc 04, which handles the case where retries are exhausted).
- Rate-limit responses (429) → respected explicitly; the adapter reads any retry-after guidance from the response and waits accordingly rather than immediately hammering the API again.
- All retry behavior is logged (without leaking the key) so a user debugging a slow session can see it was rate-limited rather than just "hanging."

## Testing this layer

Provider adapters are tested against recorded/mocked responses, not live API calls, so the test suite doesn't depend on API availability or burn real tokens (doc 12 covers this in the broader testing strategy). The interface shape itself (`base.js`) is tested with a fake adapter to confirm the orchestrator only ever calls the three defined methods and never reaches into provider-specific internals.
