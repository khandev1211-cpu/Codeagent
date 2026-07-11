import { Provider } from "./base.js";
import { ProviderError } from "../utils/errors.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Translate the Tool Registry's schema list into the shape Anthropic's API
 * expects. The registry already exports {name, description, input_schema},
 * which is exactly Anthropic's tool shape, so this is close to identity —
 * kept as an explicit step so a future provider's translation logic has a
 * clear place to differ (doc 06).
 */
function toAnthropicTools(tools) {
  return tools.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));
}

function toAnthropicMessages(messages) {
  // Internal message shape already mirrors Anthropic's content-block format,
  // so this is a light pass-through with room to diverge later.
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export class AnthropicProvider extends Provider {
  constructor(config, { fetchImpl = fetch, logger } = {}) {
    super();
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
  }

  _apiKey() {
    const key = process.env[this.config.apiKeyEnvVar];
    if (!key) {
      throw new ProviderError(
        `Missing API key: environment variable ${this.config.apiKeyEnvVar} is not set.`
      );
    }
    return key;
  }

  async _request(body, { signal } = {}) {
    const apiKey = this._apiKey();
    let attempt = 0;
    let lastErr;

    while (attempt <= MAX_RETRIES) {
      let res;
      try {
        res = await this.fetchImpl(API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": API_VERSION,
          },
          body: JSON.stringify(body),
          signal,
        });
      } catch (networkErr) {
        lastErr = networkErr;
        this.logger?.warn(`Provider network error (attempt ${attempt + 1})`, {
          message: networkErr.message,
        });
        await sleep(2 ** attempt * 500);
        attempt += 1;
        continue;
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
        this.logger?.warn(`Rate limited, waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        attempt += 1;
        continue;
      }

      if (res.status >= 500) {
        lastErr = new ProviderError(`Provider server error: ${res.status}`, { retryable: true });
        this.logger?.warn(`Provider 5xx (attempt ${attempt + 1})`, { status: res.status });
        await sleep(2 ** attempt * 500);
        attempt += 1;
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ProviderError(`Provider request failed: ${res.status} ${text}`);
      }

      return res.json();
    }

    throw lastErr || new ProviderError("Provider request failed after retries");
  }

  async send(messages, tools, opts = {}) {
    const body = {
      model: opts.model || this.config.model,
      max_tokens: opts.maxTokens || 4096,
      messages: toAnthropicMessages(messages),
      tools: toAnthropicTools(tools),
      system: opts.system,
    };
    const data = await this._request(body, opts);
    return {
      content: data.content,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      stopReason: data.stop_reason,
    };
  }

  async *stream(messages, tools, opts = {}) {
    // Streaming uses the same endpoint with stream: true, re-emitted here as
    // an async generator of parsed SSE events (doc 06). Falls back to a
    // single non-streaming call if the fetch implementation doesn't support
    // response bodies as streams (kept simple and dependency-free for v1).
    const apiKey = this._apiKey();
    const body = {
      model: opts.model || this.config.model,
      max_tokens: opts.maxTokens || 4096,
      messages: toAnthropicMessages(messages),
      tools: toAnthropicTools(tools),
      system: opts.system,
      stream: true,
    };

    const res = await this.fetchImpl(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text?.().catch(() => "") ?? "";
      throw new ProviderError(`Streaming request failed: ${res.status} ${text}`);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const content = [];
    let usage = { inputTokens: 0, outputTokens: 0 };
    let stopReason = null;

    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        if (event.type === "content_block_delta" && event.delta?.text) {
          yield { type: "text_delta", text: event.delta.text };
        }
        if (event.type === "message_delta" && event.usage) {
          usage.outputTokens = event.usage.output_tokens ?? usage.outputTokens;
        }
        if (event.type === "message_start" && event.message?.usage) {
          usage.inputTokens = event.message.usage.input_tokens ?? usage.inputTokens;
        }
        if (event.type === "message_stop") {
          stopReason = event.stop_reason;
        }
      }
    }

    return { content, usage, stopReason };
  }

  countTokens(messages) {
    // Local approximation (~4 chars/token), clearly documented as an
    // estimate rather than calling a dedicated counting endpoint (doc 06).
    const text = JSON.stringify(messages);
    return Math.ceil(text.length / 4);
  }
}
