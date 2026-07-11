import { OpenAiCompatibleProvider } from "./openAiCompatible.js";

// https://console.groq.com/docs/api-reference — OpenAI-compatible chat
// completions endpoint. Groq's free tier + very fast inference makes this a
// good default for the "free/reasoning models" goal alongside OpenRouter.
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqProvider extends OpenAiCompatibleProvider {
  constructor(config, deps = {}) {
    super(config, { ...deps, apiUrl: API_URL, requiresApiKey: true, providerLabel: "Groq" });
  }
}