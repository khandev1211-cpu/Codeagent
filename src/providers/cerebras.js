import { OpenAiCompatibleProvider } from "./openAiCompatible.js";

// https://inference-docs.cerebras.ai/api-reference — OpenAI-compatible
// chat completions endpoint, known for very high tokens/sec on open models.
const API_URL = "https://api.cerebras.ai/v1/chat/completions";

export class CerebrasProvider extends OpenAiCompatibleProvider {
  constructor(config, deps = {}) {
    super(config, { ...deps, apiUrl: API_URL, requiresApiKey: true, providerLabel: "Cerebras" });
  }
}