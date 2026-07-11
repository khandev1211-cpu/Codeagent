import { Provider } from "./base.js";
import { ProviderError } from "../utils/errors.js";

const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toOpenAiTools(tools) {
  return tools.map(({ name, description, input_schema }) => ({
    type: "function",
    function: { name, description, parameters: input_schema },
  }));
}

function toOpenAiMessages(messages, system) {
  const out = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const textParts = m.content.filter((b) => b.type === "text").map((b) => b.text);
    const toolCalls = m.content
      .filter((b) => b.type === "tool_use")
      .map((b) => ({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      }));
    const toolResults = m.content.filter((b) => b.type === "tool_result");

    if (toolResults.length) {
      for (const tr of toolResults) {
        out.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content),
        });
      }
      continue;
    }

    const entry = { role: m.role, content: textParts.join("\n") || null };
    if (toolCalls.length) entry.tool_calls = toolCalls;
    out.push(entry);
  }
  return out;
}

function fromOpenAiMessage(message) {
  const content = [];
  if (message.content) {
    content.push({ type: "text", text: message.content });
  }
  for (const call of message.tool_calls || []) {
    let input = {};
    try {
      input = JSON.parse(call.function.arguments);
    } catch {
      input = {};
    }
    content.push({ type: "tool_use", id: call.id, name: call.function.name, input });
  }
  return content;
}

/**
 * Generic adapter for any provider that speaks the OpenAI-compatible
 * /chat/completions wire format (Mistral, Groq, Cerebras, OpenRouter, and
 * Ollama's OpenAI-compatible endpoint all qualify). A concrete provider file
 * is just this class pointed at a base URL + auth scheme (doc 06 / doc 11) —
 * that's the whole adapter, no duplicated translation logic per provider.
 */
export class OpenAiCompatibleProvider extends Provider {
  constructor(config, { fetchImpl = fetch, logger, apiUrl, requiresApiKey = true, providerLabel } = {}) {
    super();
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
    this.apiUrl = apiUrl;
    this.requiresApiKey = requiresApiKey;
    this.providerLabel = providerLabel || config.provider;
  }

  _apiKey() {
    if (!this.requiresApiKey) return null;
    const key = process.env[this.config.apiKeyEnvVar];
    if (!key) {
      throw new ProviderError(
        `Missing API key: environment variable ${this.config.apiKeyEnvVar} is not set (required for ${this.providerLabel}).`
      );
    }
    return key;
  }

  _headers() {
    const headers = { "content-type": "application/json" };
    const key = this._apiKey();
    if (key) headers.authorization = `Bearer ${key}`;
    return headers;
  }

  async send(messages, tools, opts = {}) {
    // Resolved once, outside the retry loop: a missing API key is a
    // configuration problem, not a transient network failure, so it must
    // not be caught and retried by the backoff logic below.
    const headers = this._headers();

    const body = {
      model: opts.model || this.config.model,
      messages: toOpenAiMessages(messages, opts.system),
      tools: tools.length ? toOpenAiTools(tools) : undefined,
    };

    let attempt = 0;
    let lastErr;
    while (attempt <= MAX_RETRIES) {
      let res;
      try {
        res = await this.fetchImpl(this.apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: opts.signal,
        });
      } catch (networkErr) {
        lastErr = new ProviderError(
          `${this.providerLabel} request failed: ${networkErr.message}`,
          { cause: networkErr, retryable: true }
        );
        this.logger?.warn(`${this.providerLabel} network error (attempt ${attempt + 1})`, {
          message: networkErr.message,
        });
        await sleep(2 ** attempt * 500);
        attempt += 1;
        continue;
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers?.get?.("retry-after")) || 2 ** attempt;
        this.logger?.warn(`${this.providerLabel} rate limited, waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        attempt += 1;
        continue;
      }
      if (res.status >= 500) {
        this.logger?.warn(`${this.providerLabel} 5xx (attempt ${attempt + 1})`, { status: res.status });
        await sleep(2 ** attempt * 500);
        attempt += 1;
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ProviderError(`${this.providerLabel} request failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      return {
        content: fromOpenAiMessage(choice?.message || {}),
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
        stopReason: choice?.finish_reason,
      };
    }
    throw lastErr || new ProviderError(`${this.providerLabel} request failed after retries`);
  }

  async *stream(messages, tools, opts = {}) {
    // v1: single non-streaming call re-emitted as one chunk, same as the
    // OpenRouter adapter — real SSE streaming can be added per-provider
    // later without touching the interface (doc 06).
    const result = await this.send(messages, tools, opts);
    const text = result.content.find((b) => b.type === "text")?.text;
    if (text) yield { type: "text_delta", text };
    return result;
  }

  countTokens(messages) {
    const text = JSON.stringify(messages);
    return Math.ceil(text.length / 4);
  }
}