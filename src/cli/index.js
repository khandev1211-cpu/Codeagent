import { Command } from "commander";
import {
  loadConfig,
  redactedConfig,
  configExists,
  listConfiguredProviders,
  upsertProvider,
  saveGlobalConfig,
} from "../config/loader.js";
import { createLogger } from "../utils/logger.js";
import { getProvider } from "../providers/index.js";
import { resolveApiKey } from "../providers/resolveApiKey.js";
import { createDefaultRegistry } from "../tools/index.js";
import { SessionStore } from "../session/store.js";
import { Orchestrator } from "../agent/orchestrator.js";
import { ContextManager, buildProjectContext } from "../agent/context.js";
import { buildSystemPrompt } from "../agent/systemPrompt.js";
import { createConfirmer } from "../safety/confirm.js";
import { startRepl } from "./repl.js";
import { renderToolCall, renderToolDeclined, renderToolPlanned, renderText, renderError } from "./render.js";
import { ConfigError, LimitExceededError } from "../utils/errors.js";
import { runSetupWizard } from "./setup.js";
import { handleModelsCommand } from "./models.js";
import { handleMistralModelsCommand } from "./mistralModels.js";
import { HookRegistry, HOOK_EVENTS, loadHooksConfig } from "../hooks/index.js";
import { SkillRegistry } from "../skills/index.js";
import { loadPermissionRules } from "../safety/permissionRules.js";

function buildCliConfigOverrides(opts) {
  const overrides = {};
  if (opts.model) overrides.model = opts.model;
  if (opts.provider) overrides.provider = opts.provider;
  if (opts.yolo) overrides.yolo = true;
  if (opts.plan) overrides.planMode = true;
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
  const { rules: permissionRules } = loadPermissionRules({ cwd });
  const orchestrator = new Orchestrator({
    provider,
    toolRegistry,
    confirm,
    config,
    logger,
    contextManager,
    diffTracker,
    hookRegistry,
    permissionRules,
  });

  const projectContext = await buildProjectContext(cwd);
  const skillRegistry = new SkillRegistry({ cwd, logger });
  const system = buildSystemPrompt({
    projectContext,
    customAddendum: config.customSystemPromptAddendum,
    adminPrompt: config.adminSystemPrompt,
    skillsIndex: skillRegistry.formatIndexForPrompt(),
  });

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
        if (event.type === "tool_denied") renderToolDeclined(event.tool, `permission rule: ${event.rule.pattern}`);
        if (event.type === "tool_planned") renderToolPlanned(event.description);
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
  const { rules: permissionRules } = loadPermissionRules({ cwd });
  await hookRegistry.run(HOOK_EVENTS.SESSION_START, { sessionId: session.id, cwd });

  await startRepl({
    provider,
    toolRegistry,
    config,
    logger,
    session,
    sessionStore,
    diffTracker,
    cwd,
    hookRegistry,
    permissionRules,
  });

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

function permissionsCommand({ cwd }) {
  let rulesConfig;
  try {
    rulesConfig = loadPermissionRules({ cwd });
  } catch (err) {
    renderError(err.message);
    process.exitCode = 1;
    return;
  }
  if (rulesConfig.rules.length === 0) {
    renderText("No permission rules configured. Add .codeagent/permissions.json to define some — see docs/20.");
    return;
  }
  for (const rule of rulesConfig.rules) {
    renderText(`${rule.behavior === "deny" ? "deny " : "allow"}  [${rule.tool}] ${rule.pattern}`);
  }
  renderText('\nDeny always wins over allow when both match the same call. Run with --plan to preview destructive actions without performing them.');
}

function skillsCommand({ cwd }) {
  const registry = new SkillRegistry({ cwd, logger: { warn: (msg) => renderText(`(warning) ${msg}`) } });
  const skills = registry.list();
  if (skills.length === 0) {
    renderText('No skills configured. Add .codeagent/skills/<name>/SKILL.md to define one — see docs/19.');
    return;
  }
  for (const skill of skills) {
    renderText(`${skill.name}`);
    renderText(`  ${skill.description}`);
    renderText(`  file: ${skill.path}${skill.allowedTools ? `  allowed-tools: ${skill.allowedTools.join(", ")}` : ""}`);
  }
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

function providersCommand({ config }) {
  const configured = config.providers || {};
  const names = Object.keys(configured);
  if (names.length === 0) {
    renderText('No providers configured yet. Run "codeagent setup" to add one.');
    return;
  }
  for (const name of names) {
    const marker = name === config.provider ? "* " : "  ";
    const entry = configured[name];
    const keySource = entry.useKeychain ? "keychain" : `env:${entry.apiKeyEnvVar}`;
    renderText(`${marker}${name}  model=${entry.model || "(default)"}  key=${keySource}`);
  }
  renderText(
    '\n(* = active)  Run "codeagent use <provider> [model]" to switch, or "codeagent models <provider>" to see every model available for one.'
  );
}

async function useCommand(providerArg, modelArg, { homedir } = {}) {
  const configured = listConfiguredProviders({ homedir });
  const existing = configured[providerArg];
  if (!existing) {
    renderError(`"${providerArg}" is not configured yet. Run "codeagent setup" to add it first.`);
    process.exitCode = 1;
    return;
  }
  const model = modelArg || existing.model;
  upsertProvider(
    { provider: providerArg, apiKeyEnvVar: existing.apiKeyEnvVar, model, useKeychain: existing.useKeychain },
    { homedir, makeActive: true }
  );
  renderText(`Switched to ${providerArg}${model ? ` (${model})` : ""}. Your session history carries over regardless of which provider is active.`);
}

async function systemPromptCommand(action, text, { homedir } = {}) {
  const effectiveAction = action || "show";
  if (effectiveAction === "show") {
    const config = loadConfig({}, { cwd: process.cwd(), homedir });
    if (!config.adminSystemPrompt) {
      renderText('No admin system prompt set. Run: codeagent system-prompt set "<your instruction>"');
      return;
    }
    renderText(config.adminSystemPrompt);
    return;
  }
  if (effectiveAction === "set") {
    if (!text || !text.trim()) {
      renderError('Usage: codeagent system-prompt set "<your instruction>"');
      process.exitCode = 1;
      return;
    }
    saveGlobalConfig({ adminSystemPrompt: text.trim() }, { homedir });
    renderText("Saved. This applies across every project until you change or clear it (docs/18).");
    return;
  }
  if (effectiveAction === "clear") {
    saveGlobalConfig({ adminSystemPrompt: "" }, { homedir });
    renderText("Cleared your admin system prompt.");
    return;
  }
  renderError(`Unknown action "${effectiveAction}". Use "show", "set <text>", or "clear".`);
  process.exitCode = 1;
}

/**
 * Decides whether to run the setup wizard before dispatching any command —
 * the first-run detection docs/18 describes. Factored out (rather than
 * inlined in run()) so the decision logic is unit-testable without
 * needing to drive a real interactive wizard.
 */
export function shouldRunFirstTimeSetup(argv, { homedir } = {}) {
  const args = argv.slice(2);
  const isExplicitSetupCommand = args[0] === "setup";
  const isHelpOrVersion = args.some((a) => ["--help", "-h", "--version", "-V"].includes(a));
  if (isExplicitSetupCommand || isHelpOrVersion) return false;
  return !configExists({ homedir });
}
export async function run(argv) {
  if (shouldRunFirstTimeSetup(argv)) {
    const cwd = process.cwd();
    const config = loadConfig({}, { cwd });
    const logger = createLogger({ level: config.logLevel });
    renderText("No provider configured yet — let's set one up.\n");
    await runSetupWizard(config, logger);
    renderText("\nContinuing with your original command...\n");
  }

  const program = new Command();
  program
    .name("codeagent")
    .description("A terminal-native AI coding agent — describe a goal, watch it build.")
    .argument("[request]", "One-shot request; omit to start an interactive session")
    .option("--resume <id>", "Resume a saved session ('last' for most recent)")
    .option("--yolo", "Skip destructive-action confirmations for this run")
    .option("--plan", "Plan mode: describe destructive actions instead of performing them (docs/20)")
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
    .command("permissions")
    .description("List permission rules configured for this project (.codeagent/permissions.json)")
    .action(() => {
      permissionsCommand({ cwd: process.cwd() });
    });

  program
    .command("skills")
    .description("List skills discovered in .codeagent/skills/")
    .action(() => {
      skillsCommand({ cwd: process.cwd() });
    });

  program
    .command("hooks")
    .description("List hooks configured for this project (.codeagent/hooks.json)")
    .action(() => {
      hooksCommand({ cwd: process.cwd() });
    });

  program
    .command("providers")
    .description("List every configured provider, which one is active, and where its key comes from")
    .action(() => {
      try {
        const config = loadConfig({}, { cwd: process.cwd() });
        providersCommand({ config });
      } catch (err) {
        renderError(err.message);
        process.exitCode = 1;
      }
    });

  program
    .command("use <provider> [model]")
    .description("Switch the active provider/model (persists in ~/.codeagentrc; history carries over)")
    .action(async (providerArg, modelArg) => {
      await useCommand(providerArg, modelArg, {});
    });

  program
    .command("system-prompt [action] [text...]")
    .description('Manage your global admin system prompt: "show" (default), "set <text>", or "clear"')
    .action(async (action, textParts) => {
      await systemPromptCommand(action, (textParts || []).join(" "), {});
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

    const logger = createLogger({ level: config.logLevel });
    const provider = getProvider(config, { logger });

    if (provider.requiresApiKey !== false) {
      const key = await resolveApiKey({ provider: config.provider, apiKeyEnvVar: config.apiKeyEnvVar, logger });
      if (!key) {
        renderError(
          `No API key found for ${config.provider}. Set ${config.apiKeyEnvVar} in your shell, or run "codeagent setup" to save one.`
        );
        process.exitCode = 1;
        return;
      }
    }

    if (request) {
      await oneShot(request, { config, logger, cwd });
      return;
    }
    await interactive({ config, logger, cwd, resumeId: opts.resume });
  });

  await program.parseAsync(argv);
}
