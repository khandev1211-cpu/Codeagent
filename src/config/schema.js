import { z } from "zod";

// Providers ship as adapters (src/providers/*.js). Adding one here plus a
// factory `case` in src/providers/index.js is the whole extension surface —
// doc 06 / doc 11.
export const ConfigSchema = z.object({
  provider: z
    .enum(["anthropic", "openrouter", "mistral", "groq", "cerebras", "ollama"])
    .default("anthropic"),
  model: z.string().default("claude-sonnet-4-6"),
  apiKeyEnvVar: z.string().default("ANTHROPIC_API_KEY"),
  maxIterationsPerTurn: z.number().int().positive().default(25),
  maxTokenBudgetPerSession: z.number().int().positive().optional(),
  yolo: z.boolean().default(false),
  allowedWritePaths: z.array(z.string()).default(["."]),
  planningEnabled: z.boolean().default(false),
  customSystemPromptAddendum: z.string().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Only read by the Ollama adapter (doc 06) — lets users point at a
  // non-default port or a remote host running Ollama.
  ollamaBaseUrl: z.string().optional(),
  // Every provider the user has ever configured via `codeagent setup`
  // (whether or not it's the currently active one), keyed by provider name.
  // `provider`/`model`/`apiKeyEnvVar` above remain "the active selection" —
  // existing code that reads those three fields is unaffected. This map is
  // what makes "add another provider" and `codeagent providers`/`use`
  // possible without redesigning the resolved-config shape everything else
  // already depends on. See docs/18.
  providers: z
    .record(
      z.string(),
      z.object({
        apiKeyEnvVar: z.string(),
        model: z.string().optional(),
        useKeychain: z.boolean().optional(),
      })
    )
    .default({}),
  // A standing, global instruction from whoever runs `codeagent setup` on
  // this machine — takes priority over the built-in system prompt but
  // doesn't replace it (docs/18). Global-only by design: it's meant to be
  // "how I personally want codeagent to behave," not a per-project setting
  // (use customSystemPromptAddendum above for that).
  adminSystemPrompt: z.string().optional(),
});

export function getDefaults() {
  return ConfigSchema.parse({});
}

// Per-provider default model/env-var pairs, applied only when the user
// switches provider without also specifying model/apiKeyEnvVar explicitly.
export const PROVIDER_DEFAULTS = {
  anthropic: { model: "claude-sonnet-4-6", apiKeyEnvVar: "ANTHROPIC_API_KEY" },
  openrouter: { model: "openrouter/auto", apiKeyEnvVar: "OPENROUTER_API_KEY" },
  mistral: { model: "codestral-latest", apiKeyEnvVar: "MISTRAL_API_KEY" },
  groq: { model: "llama-3.3-70b-versatile", apiKeyEnvVar: "GROQ_API_KEY" },
  cerebras: { model: "llama-3.3-70b", apiKeyEnvVar: "CEREBRAS_API_KEY" },
  ollama: { model: "llama3.1", apiKeyEnvVar: "OLLAMA_API_KEY" },
};