import { AnthropicProvider } from "./anthropic.js";
import { OpenRouterProvider } from "./openrouter.js";
import { MistralProvider } from "./mistral.js";
import { GroqProvider } from "./groq.js";
import { CerebrasProvider } from "./cerebras.js";
import { OllamaProvider } from "./ollama.js";
import { ConfigError } from "../utils/errors.js";

/**
 * Reads the resolved config and returns the right adapter instance. Adding a
 * second provider means adding one case here and one new adapter file —
 * nothing else in the codebase changes (doc 06 / doc 11).
 */
export function getProvider(config, deps = {}) {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config, deps);
    case "openrouter":
      return new OpenRouterProvider(config, deps);
    case "mistral":
      return new MistralProvider(config, deps);
    case "groq":
      return new GroqProvider(config, deps);
    case "cerebras":
      return new CerebrasProvider(config, deps);
    case "ollama":
      return new OllamaProvider(config, deps);
    default:
      throw new ConfigError(`Unknown provider: ${config.provider}`);
  }
}
