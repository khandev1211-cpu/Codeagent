import { ModelRegistry } from "../providers/modelRegistry.js";

/**
 * CLI command: Display available models for a provider.
 * Usage: codeagent models [provider] [--details]
 */
export async function handleModelsCommand(options = {}) {
  const { provider = "anthropic", details = false, logger = console } = options;

  const registry = new ModelRegistry({ logger });

  try {
    const models = await registry.getAvailableModels(provider);

    if (models.length === 0) {
      console.log(`❌ No models found for provider: ${provider}`);
      return;
    }

    console.log(`\n📊 Available Models for ${provider}\n`);
    console.log("━".repeat(80));

    models.forEach((model, i) => {
      console.log(`\n${i + 1}. ${model.name}`);
      console.log(`   ID: ${model.id}`);

      if (model.free) {
        console.log(`   Cost: Free 🆓`);
      } else if (model.costPer1kInputTokens || model.costPer1kOutputTokens) {
        const inputCost = (model.costPer1kInputTokens * 1000).toFixed(4);
        const outputCost = (model.costPer1kOutputTokens * 1000).toFixed(4);
        console.log(`   Cost: $${inputCost}/1M input tokens, $${outputCost}/1M output tokens`);
      }

      if (model.contextWindow) {
        console.log(`   Context: ${model.contextWindow.toLocaleString()} tokens`);
      }

      const features = [];
      if (model.supportsToolUse) features.push("tool_use");
      if (model.supportsVision) features.push("vision");
      if (features.length > 0) {
        console.log(`   Features: ${features.join(", ")}`);
      }

      if (details) {
        if (model.description) console.log(`   Description: ${model.description}`);
        if (model.local) console.log(`   Local: Yes (Ollama)`);
        if (model.size) console.log(`   Size: ${model.size}`);
      }
    });

    console.log("\n" + "━".repeat(80) + "\n");
  } catch (error) {
    console.error(`❌ Error fetching models: ${error.message}`);
    process.exitCode = 1;
  }
}

/**
 * Search for models across all providers.
 */
export async function searchModels(query, options = {}) {
  const { logger = console } = options;

  const registry = new ModelRegistry({ logger });

  try {
    const results = await registry.searchModels(query);

    if (results.length === 0) {
      console.log(`❌ No models found matching: "${query}"`);
      return;
    }

    console.log(`\n🔍 Search Results for "${query}"\n`);
    console.log("━".repeat(80));

    results.forEach((model) => {
      console.log(
        `\n${model.name} (${model.provider})\n   ID: ${model.id}\n   Cost: ${model.free ? "Free 🆓" : `$${model.costPer1kInputTokens}`}`
      );
    });

    console.log("\n" + "━".repeat(80) + "\n");
  } catch (error) {
    console.error(`❌ Error searching models: ${error.message}`);
    process.exitCode = 1;
  }
}
