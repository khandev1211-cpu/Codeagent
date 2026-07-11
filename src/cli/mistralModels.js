/**
 * CLI command: List Mistral models directly from API.
 * This fetches live models using the user's API key.
 */
export async function handleMistralModelsCommand() {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    console.error("❌ MISTRAL_API_KEY environment variable not set");
    console.error("   Set it before running this command:");
    console.error('   $env:MISTRAL_API_KEY = "your-key-here"');
    process.exitCode = 1;
    return;
  }

  console.log("\n🔑 Fetching Mistral models from API...\n");

  try {
    const response = await fetch("https://api.mistral.ai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        console.error("   Invalid or expired API key");
      }
      process.exitCode = 1;
      return;
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      console.error("❌ Unexpected API response format");
      process.exitCode = 1;
      return;
    }

    // Filter for text generation models only
    const textGenModels = data.data.filter((model) => {
      const capabilities = Array.isArray(model.capabilities)
        ? model.capabilities
        : Object.keys(model.capabilities || {}).filter((k) => model.capabilities[k]);
      
      // Include if has completion_chat and exclude audio/specialized models
      return (
        capabilities.includes("completion_chat") &&
        !capabilities.includes("audio") &&
        !model.id.startsWith("labs-") &&
        !model.id.startsWith("voxtral-")
      );
    });

    console.log(`✅ Found ${textGenModels.length} text generation models\n`);
    console.log("━".repeat(80));

    textGenModels.forEach((model, i) => {
      console.log(`\n${i + 1}. ${model.id}`);
      if (model.description) {
        console.log(`   Description: ${model.description}`);
      }
      if (model.capabilities) {
        const capString = Array.isArray(model.capabilities)
          ? model.capabilities.join(", ")
          : Object.keys(model.capabilities || {})
              .filter((k) => model.capabilities[k])
              .join(", ");
        if (capString) {
          console.log(`   Capabilities: ${capString}`);
        }
      }
      if (model.context_window) {
        console.log(`   Context Window: ${model.context_window.toLocaleString()} tokens`);
      }
      if (model.max_tokens) {
        console.log(`   Max Tokens: ${model.max_tokens.toLocaleString()}`);
      }
    });

    console.log("\n" + "━".repeat(80) + "\n");
    console.log("✅ These models are all accessible with your API key!\n");
  } catch (error) {
    console.error(`❌ Failed to fetch models: ${error.message}`);
    if (error.message.includes("fetch failed")) {
      console.error("   Check your network connection or API key");
    }
    process.exitCode = 1;
  }
}
