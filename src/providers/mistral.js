import { OpenAiCompatibleProvider } from "./openAiCompatible.js";

// https://docs.mistral.ai/api — OpenAI-compatible chat completions endpoint.
const API_URL = "https://api.mistral.ai/v1/chat/completions";

export class MistralProvider extends OpenAiCompatibleProvider {
  constructor(config, deps = {}) {
    super(config, { ...deps, apiUrl: API_URL, requiresApiKey: true, providerLabel: "Mistral" });
  }
}