import { OpenAiCompatibleProvider } from "./openAiCompatible.js";

// Ollama runs locally and exposes an OpenAI-compatible /v1/chat/completions
// endpoint (in addition to its native /api/chat). No API key needed since
// it's talking to localhost — this is the fully-offline/free option.
// Base URL is configurable via `ollamaBaseUrl` (config) or OLLAMA_HOST (env),
// since users often run Ollama on a non-default port or a remote box.
const DEFAULT_BASE_URL = "http://localhost:11434";

export class OllamaProvider extends OpenAiCompatibleProvider {
  constructor(config, deps = {}) {
    const baseUrl = config.ollamaBaseUrl || process.env.OLLAMA_HOST || DEFAULT_BASE_URL;
    const apiUrl = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
    super(config, { ...deps, apiUrl, requiresApiKey: false, providerLabel: "Ollama" });
  }
}