import { Command } from "commander";
import { loadConfig, redactedConfig } from "../config/loader.js";
import { createLogger } from "../utils/logger.js";
import { getProvider } from "../providers/index.js";
import { createDefaultRegistry } from "../tools/index.js";
import { SessionStore } from "../session/store.js";
import { Orchestrator } from "../agent/orchestrator.js";
import { ContextManager, buildProjectContext } from "../agent/context.js";
import { buildSystemPrompt } from "../agent/systemPrompt.js";
import { createConfirmer } from "../safety/confirm.js";
import { startRepl } from "./repl.js";
import { renderToolCall, renderToolDeclined, renderText, renderError } from "./render.js";
import { ConfigError, LimitExceededError } from "../utils/errors.js";
import { runSetupWizard } from "./setup.js";
import { handleModelsCommand } from "./models.js";
import { handleMistralModelsCommand } from "./mistralModels.js";
import { HookRegistry, HOOK_EVENTS, loadHooksConfig } from "../hooks/index.js";

function buildCliConfigOverrides(opts) {
  const overrides = {};
  if (opts.model) overrides.model = opts.model;
  if (opts.provider) overrides.provider = opts.provider;
  if (opts.yolo) overrides.yolo = true;
  return overrides;
}

async function oneShot(request, { config, logger, cwd }) {
  const provider = getProvider(config, { logger });
  const toolRegistry = createDefaultRegistry();
  const sessionStore = new SessionStore({ projectRoot: cwd });
  const session = sessionStore.create({ provider: config.provider, model: config.model });
  const diffTracker = sessionStore.diffTrackerFor(session);
  const confirm = createConfirmer({ config, logger });
  const contextManager = new ContextManager({ provider });
  const hookRegistry = new HookRegistry({ cwd, logger });
  const orchestrator = new Orchestrator({
    provider,
    toolRegistry,
    confirm,
    config,
    logger,
    contextManager,
    diffTracker,
    hookRegistry,
  });

  const projectContext = await buildProjectContext(cwd);
  const system = buildSystemPrompt({ projectContext, customAddendum: config.customSystemPromptAddendum });

  await hookRegistry.run(HOOK_EVENTS.SESSION_START, { sessionId: session.id, cwd });

  try {
    const result = await orchestrator.runTurn({
      messages: session.messages,
      userInput: request,
      system,
      cwd,
      onEvent: (event) => {
        if (event.type === "tool_call") renderToolCall(event.tool, event.input);
        if (event.type === "tool_declined") {
          renderToolDeclined(event.tool, event.reason);
          if (event.reason === "no-tty") process.exitCode = 1;
        }
        if (event.type === "tool_blocked") renderToolDeclined(event.tool, `hook: ${event.reason}`);
        if (event.type === "final_text") renderText(event.text);
        if (event.type === "tool_error") renderError(`${event.tool}: ${event.error.message}`);
      },
    });
    session.messages = result.history;
    sessionStore.syncDiffTracker(session, diffTracker);
    await sessionStore.save(session);
    if (process.exitCode === undefined) process.exitCode = 0;
  } catch (err) {
    renderError(err.message);
    process.exitCode = err instanceof LimitExceededError ? 2 : 1;
  } finally {
    await hookRegistry.run(HOOK_EVENTS.SESSION_END, { sessionId: session.id, cwd });
  }
}

async function interactive({ config, logger, cwd, resumeId }) {
  const provider = getProvider(config, { logger });
  const toolRegistry = createDefaultRegistry();
  const sessionStore = new SessionStore({ projectRoot: cwd });

  let session;
  if (resumeId === "last") {
    session = await sessionStore.loadLastForProject();
    if (!session) {
      renderError("No saved session found for this project.");
      process.exitCode = 1;
      return;
    }
  } else if (resumeId) {
    try {
      session = await sessionStore.load(resumeId);
    } catch {
      renderError(`No session found with id ${resumeId}`);
      process.exitCode = 1;
      return;
    }
  } else {
    session = sessionStore.create({ provider: config.provider, model: config.model });
  }

  const diffTracker = sessionStore.diffTrackerFor(session);
  const hookRegistry = new HookRegistry({ cwd, logger });
  await hookRegistry.run(HOOK_EVENTS.SESSION_START, { sessionId: session.id, cwd });

  await startRepl({ provider, toolRegistry, config, logger, session, sessionStore, diffTracker, cwd, hookRegistry });

  await hookRegistry.run(HOOK_EVENTS.SESSION_END, { sessionId: session.id, cwd });
}

async function undoCommand(ref, { cwd }) {
  const sessionStore = new SessionStore({ projectRoot: cwd });
  const session = await sessionStore.loadLastForProject();
  if (!session) {
    renderError("No session found for this project.");
    process.exitCode = 1;
    return;
  }
  const diffTracker = sessionStore.diffTrackerFor(session);
  const entry = ref ? diffTracker.findById(ref) : diffTracker.mostRecent();
  if (!entry) {
    renderError(ref ? `No recorded change with id ${ref}` : "Nothing to undo.");
    process.exitCode = 1;
    return;
  }
  await diffTracker.revert(entry);
  sessionStore.syncDiffTracker(session, diffTracker);
  await sessionStore.save(session);
  renderText(`Reverted change to ${entry.path} (${entry.id})`);
}

async function sessionsCommand({ cwd }) {
  const sessionStore = new SessionStore({ projectRoot: cwd });
  const sessions = (await sessionStore.list()).filter((s) => s.projectRoot === cwd);
  if (sessions.length === 0) {
    renderText("No saved sessions for this project.");
    return;
  }
  for (const s of sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))) {
    renderText(`${s.id}  ${s.updatedAt}  ${s.provider}/${s.model}  (${s.messages.length} messages)`);
  }
}

function configCommand({ config }) {
  renderText(JSON.stringify(redactedConfig(config), null, 2));
}

function hooksCommand({ cwd }) {
  let hooksConfig;
  try {
    hooksConfig = loadHooksConfig({ cwd });
  } catch (err) {
    renderError(err.message);
    process.exitCode = 1;
    return;
  }
  const events = Object.keys(hooksConfig.hooks || {});
  if (events.length === 0) {
    renderText("No hooks configured. Add .codeagent/hooks.json to define some — see docs/17.");
    return;
  }
  for (const event of events) {
    renderText(`${event}:`);
    for (const def of hooksConfig.hooks[event]) {
      renderText(`  ${def.matcher ? `[${def.matcher}] ` : ""}${def.command}`);
    }
  }
}

export async function run(argv) {
  const program = new Command();
  program
    .name("codeagent")
    .description("A terminal-native AI coding agent — describe a goal, watch it build.")
    .argument("[request]", "One-shot request; omit to start an interactive session")
    .option("--resume <id>", "Resume a saved session ('last' for most recent)")
    .option("--yolo", "Skip destructive-action confirmations for this run")
    .option("--model <name>", "Override the configured model")
    .option("--provider <name>", "Override the configured provider");

  program
    .command("undo [ref]")
    .description("Revert the most recent destructive change, or a specific one by id")
    .action(async (ref) => {
      await undoCommand(ref, { cwd: process.cwd() });
    });

  program
    .command("sessions")
    .description("List saved sessions for this project")
    .action(async () => {
      await sessionsCommand({ cwd: process.cwd() });
    });

  program
    .command("config")
    .description("Print the fully resolved config (API key redacted)")
    .action(() => {
      try {
        const config = loadConfig({}, { cwd: process.cwd() });
        configCommand({ config });
      } catch (err) {
        renderError(err.message);
        process.exitCode = 1;
      }
    });

  program
    .command("hooks")
    .description("List hooks configured for this project (.codeagent/hooks.json)")
    .action(() => {
      hooksCommand({ cwd: process.cwd() });
    });

  program
    .command("setup")
    .description("Run interactive setup wizard for first-time configuration")
    .action(async () => {
      try {
        const config = loadConfig({}, { cwd: process.cwd() });
        const logger = createLogger({ level: config.logLevel });
        await runSetupWizard(config, logger);
      } catch (err) {
        renderError(err.message);
        process.exitCode = 1;
      }
    });

  const modelsCmd = program
    .command("models [provider]")
    .description("List available models for a provider")
    .option("--details", "Show detailed model information (pricing, context, etc.)");

  modelsCmd.action(async function(provider) {
    try {
      const opts = this.opts() || {};
      // Provider can be passed as positional argument or default to anthropic
      const selectedProvider = provider || "anthropic";
      const options = {
        provider: selectedProvider,
        details: opts.details || false,
      };
      await handleModelsCommand(options);
    } catch (err) {
      renderError(err.message);
      process.exitCode = 1;
    }
  });

  program
    .command("mistral-models")
    .description("List all Mistral models accessible via your API key (live from API)")
    .action(async () => {
      try {
        await handleMistralModelsCommand();
      } catch (err) {
        renderError(err.message);
        process.exitCode = 1;
      }
    });

  program.action(async (request, opts) => {
    const cwd = process.cwd();
    let config;
    try {
      config = loadConfig(buildCliConfigOverrides(opts), { cwd });
    } catch (err) {
      if (err instanceof ConfigError) {
        renderError(err.message);
        process.exitCode = 1;
        return;
      }
      throw err;
    }

    if (!process.env[config.apiKeyEnvVar]) {
      renderError(
        `Environment variable ${config.apiKeyEnvVar} is not set. Set it before running codeagent, e.g.:\n  export ${config.apiKeyEnvVar}="..."`
      );
      process.exitCode = 1;
      return;
    }

    const logger = createLogger({ level: config.logLevel });

    if (request) {
      await oneShot(request, { config, logger, cwd });
      return;
    }
    await interactive({ config, logger, cwd, resumeId: opts.resume });
  });

  await program.parseAsync(argv);
}
