/**
 * Model registry and detection — lists available models for each LLM provider.
 * Fetches models from provider APIs where available, with fallback to known lists.
 */

export class ModelRegistry {
  constructor({ providers = {}, logger = console } = {}) {
    this.providers = providers;
    this.logger = logger;
    this.modelCache = {};
  }

  /**
   * Get available models for a provider.
   * Tries live API first, falls back to known models.
   */
  async getAvailableModels(provider, forceRefresh = false) {
    const cacheKey = `models:${provider}`;
    if (this.modelCache[cacheKey] && !forceRefresh) {
      return this.modelCache[cacheKey];
    }

    let models = [];

    switch (provider) {
      case "anthropic":
        models = await this._getAnthropicModels();
        break;
      case "mistral":
        models = await this._getMistralModels();
        break;
      case "groq":
        models = await this._getGroqModels();
        break;
      case "cerebras":
        models = await this._getCerebrasModels();
        break;
      case "openrouter":
        models = await this._getOpenRouterModels();
        break;
      case "ollama":
        models = await this._getOllamaModels();
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    this.modelCache[cacheKey] = models;
    return models;
  }

  /**
   * Get model capabilities (context window, pricing, supports tool_use, etc.)
   */
  async getModelCapabilities(provider, model) {
    const models = await this.getAvailableModels(provider);
    return models.find((m) => m.id === model) || null;
  }

  /**
   * Validate that a model exists and is available for a provider.
   */
  async validateModel(provider, model) {
    const models = await this.getAvailableModels(provider);
    return models.some((m) => m.id === model);
  }

  // ==================== Anthropic ====================

  async _getAnthropicModels() {
    // Known Anthropic models (Claude family)
    // In production, could fetch from /models API if available
    return [
      {
        id: "claude-opus-4-1",
        name: "Claude Opus (Latest)",
        contextWindow: 200000,
        costPer1kInputTokens: 0.015,
        costPer1kOutputTokens: 0.075,
        supportsToolUse: true,
        supportsVision: true,
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet (Latest)",
        contextWindow: 200000,
        costPer1kInputTokens: 0.003,
        costPer1kOutputTokens: 0.015,
        supportsToolUse: true,
        supportsVision: true,
      },
      {
        id: "claude-haiku-3-5",
        name: "Claude Haiku (Latest)",
        contextWindow: 200000,
        costPer1kInputTokens: 0.0008,
        costPer1kOutputTokens: 0.0024,
        supportsToolUse: true,
        supportsVision: true,
      },
    ];
  }

  // ==================== Mistral ====================

  async _getMistralModels() {
    // Try to fetch live models from Mistral API first
    try {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        return this._getMistralFallbackModels();
      }

      const response = await fetch("https://api.mistral.ai/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        this.logger.debug(`Mistral API error: ${response.status}`);
        return this._getMistralFallbackModels();
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        return this._getMistralFallbackModels();
      }

      // Map Mistral API response to our format
      return data.data.map((model) => ({
        id: model.id,
        name: this._getMistralModelName(model.id),
        contextWindow: this._getMistralContextWindow(model.id),
        costPer1kInputTokens: this._getMistralInputCost(model.id),
        costPer1kOutputTokens: this._getMistralOutputCost(model.id),
        supportsToolUse: this._getMistralSupportsToolUse(model.id),
        supportsVision: false,
        description: model.description || null,
      }));
    } catch (error) {
      this.logger.debug(`Failed to fetch Mistral models from API: ${error.message}`);
      return this._getMistralFallbackModels();
    }
  }

  _getMistralFallbackModels() {
    // Fallback to known Mistral models
    return [
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        contextWindow: 32000,
        costPer1kInputTokens: 0.003,
        costPer1kOutputTokens: 0.009,
        supportsToolUse: true,
        supportsVision: false,
      },
      {
        id: "mistral-medium-latest",
        name: "Mistral Medium",
        contextWindow: 32000,
        costPer1kInputTokens: 0.0014,
        costPer1kOutputTokens: 0.0042,
        supportsToolUse: true,
        supportsVision: false,
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        contextWindow: 32000,
        costPer1kInputTokens: 0.00014,
        costPer1kOutputTokens: 0.00042,
        supportsToolUse: true,
        supportsVision: false,
      },
      {
        id: "mistral-tiny-latest",
        name: "Mistral Tiny",
        contextWindow: 32000,
        costPer1kInputTokens: 0.00014,
        costPer1kOutputTokens: 0.00042,
        supportsToolUse: false,
        supportsVision: false,
      },
    ];
  }

  _getMistralModelName(modelId) {
    const names = {
      "mistral-large-latest": "Mistral Large",
      "mistral-medium-latest": "Mistral Medium",
      "mistral-small-latest": "Mistral Small",
      "mistral-tiny-latest": "Mistral Tiny",
    };
    return names[modelId] || modelId;
  }

  _getMistralContextWindow(modelId) {
    return 32000; // Standard for all Mistral models
  }

  _getMistralInputCost(modelId) {
    const costs = {
      "mistral-large-latest": 0.003,
      "mistral-medium-latest": 0.0014,
      "mistral-small-latest": 0.00014,
      "mistral-tiny-latest": 0.00014,
    };
    return costs[modelId] || 0;
  }

  _getMistralOutputCost(modelId) {
    const costs = {
      "mistral-large-latest": 0.009,
      "mistral-medium-latest": 0.0042,
      "mistral-small-latest": 0.00042,
      "mistral-tiny-latest": 0.00042,
    };
    return costs[modelId] || 0;
  }

  _getMistralSupportsToolUse(modelId) {
    // All Mistral models except Tiny support tool use
    return modelId !== "mistral-tiny-latest";
  }

  // ==================== Groq ====================

  async _getGroqModels() {
    // Known Groq models (free tier)
    return [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B Versatile",
        contextWindow: 8192,
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        supportsToolUse: true,
        supportsVision: false,
        free: true,
      },
      {
        id: "llama-3.1-405b-reasoning",
        name: "Llama 3.1 405B Reasoning",
        contextWindow: 131072,
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        supportsToolUse: true,
        supportsVision: false,
        free: true,
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        contextWindow: 32768,
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        supportsToolUse: false,
        supportsVision: false,
        free: true,
      },
    ];
  }

  // ==================== Cerebras ====================

  async _getCerebrasModels() {
    // Known Cerebras models
    return [
      {
        id: "llama-3.3-70b",
        name: "Llama 3.3 70B",
        contextWindow: 8192,
        costPer1kInputTokens: 0.00005,
        costPer1kOutputTokens: 0.00015,
        supportsToolUse: true,
        supportsVision: false,
      },
      {
        id: "llama-3.1-70b",
        name: "Llama 3.1 70B",
        contextWindow: 131072,
        costPer1kInputTokens: 0.00005,
        costPer1kOutputTokens: 0.00015,
        supportsToolUse: true,
        supportsVision: false,
      },
    ];
  }

  // ==================== OpenRouter ====================

  async _getOpenRouterModels() {
    // Sample of popular OpenRouter models (could fetch live from /models)
    return [
      {
        id: "openrouter/auto",
        name: "OpenRouter Auto",
        contextWindow: 8000,
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        supportsToolUse: true,
        supportsVision: true,
        description: "Automatically selects the best model",
      },
      {
        id: "meta-llama/llama-2-70b-chat",
        name: "Llama 2 70B Chat",
        contextWindow: 4096,
        costPer1kInputTokens: 0.0007,
        costPer1kOutputTokens: 0.0009,
        supportsToolUse: false,
        supportsVision: false,
      },
      {
        id: "openai/gpt-4-turbo",
        name: "GPT-4 Turbo",
        contextWindow: 128000,
        costPer1kInputTokens: 0.01,
        costPer1kOutputTokens: 0.03,
        supportsToolUse: true,
        supportsVision: true,
      },
    ];
  }

  // ==================== Ollama (Local) ====================

  async _getOllamaModels(baseUrl = "http://localhost:11434") {
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) return this._getOllamaFallbackModels();

      const data = await response.json();
      return (data.models || []).map((m) => ({
        id: m.name,
        name: m.name,
        contextWindow: m.details?.parameter_size || 4096,
        supportsToolUse: false, // Most local models don't support tool_use
        supportsVision: false,
        local: true,
        size: m.size,
      }));
    } catch (error) {
      this.logger.debug("Failed to fetch Ollama models:", error.message);
      return this._getOllamaFallbackModels();
    }
  }

  _getOllamaFallbackModels() {
    // Fallback models if Ollama is not running or unreachable
    return [
      {
        id: "llama3.1",
        name: "Llama 3.1 (local)",
        contextWindow: 8192,
        supportsToolUse: false,
        supportsVision: false,
        local: true,
      },
      {
        id: "mistral",
        name: "Mistral (local)",
        contextWindow: 32000,
        supportsToolUse: false,
        supportsVision: false,
        local: true,
      },
      {
        id: "neural-chat",
        name: "Neural Chat (local)",
        contextWindow: 4096,
        supportsToolUse: false,
        supportsVision: false,
        local: true,
      },
    ];
  }

  // ==================== Utilities ====================

  /**
   * Get all providers' available models in one call.
   */
  async getAllModels(providers) {
    const result = {};
    for (const provider of providers) {
      try {
        result[provider] = await this.getAvailableModels(provider);
      } catch (error) {
        this.logger.warn(`Failed to fetch models for ${provider}:`, error.message);
        result[provider] = [];
      }
    }
    return result;
  }

  /**
   * Search for models matching a query string.
   */
  async searchModels(query, providers = null) {
    const allProviders = providers || ["anthropic", "mistral", "groq", "cerebras", "openrouter"];
    const allModels = await this.getAllModels(allProviders);

    const results = [];
    for (const [provider, models] of Object.entries(allModels)) {
      for (const model of models) {
        if (
          model.id.toLowerCase().includes(query.toLowerCase()) ||
          (model.name && model.name.toLowerCase().includes(query.toLowerCase()))
        ) {
          results.push({ provider, ...model });
        }
      }
    }
    return results;
  }
}
