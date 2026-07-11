import { OpenAiCompatibleProvider } from "./openAiCompatible.js";

// OpenRouter proxies many providers, including a rotating set of ":free"
// tagged models (e.g. "meta-llama/llama-3.1-405b-instruct:free"). Picking a
// specific free model is a config choice (`model`), not a code change.
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterProvider extends OpenAiCompatibleProvider {
  constructor(config, deps = {}) {
    super(config, { ...deps, apiUrl: API_URL, requiresApiKey: true, providerLabel: "OpenRouter" });
  }
}