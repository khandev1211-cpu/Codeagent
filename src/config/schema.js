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
  // Distinct from planningEnabled above, despite the similar name: that
  // one (agent/planner.js) generates a task checklist shown before
  // execution — a planning aid, execution still happens normally. This
  // one (safety/planMode.js) makes destructive tools describe themselves
  // instead of running at all, structurally, for the whole session — a
  // read-only execution mode, matching Claude Code's actual "Plan Mode"
  // naming (docs/20). They're unrelated and can be used independently or
  // together.
  planMode: z.boolean().default(false),
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
  // Controls how much of the skills index is paid for on every turn
  // (docs/19's "known but deliberately deferred" tradeoff). "compact"
  // sends only skill names (near-zero cost) and the model calls the
  // skill_info tool on demand for descriptions of skills that look
  // relevant to the current task. "full" keeps the original behavior —
  // every name + description inline on every turn — for anyone who'd
  // rather pay the fixed cost than the extra tool round-trip. Default is
  // "compact" since that's the actual fix for the flagged cost.
  skillsIndexMode: z.enum(["compact", "full"]).default("compact"),
  // Confines run_bash's *writes* to allowedWritePaths via bubblewrap
  // (Linux) or sandbox-exec (macOS), when available — reads remain
  // unrestricted (src/safety/sandbox.js has the full reasoning). "auto"
  // uses a sandbox when the platform supports it and logs a warning (not
  // silent) when it can't; "off" skips detection entirely and runs
  // unsandboxed, same as pre-sandboxing behavior. There is deliberately no
  // "strict" mode that refuses to run without a sandbox — that would turn
  // an availability gap (e.g. Windows, or Linux without bwrap installed)
  // into a hard failure for an existing, already-shipped tool.
  sandboxMode: z.enum(["auto", "off"]).default("auto"),
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