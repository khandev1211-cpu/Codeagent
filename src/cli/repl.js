import readline from "node:readline/promises";
import { Orchestrator } from "../agent/orchestrator.js";
import { ContextManager, buildProjectContext } from "../agent/context.js";
import { buildSystemPrompt } from "../agent/systemPrompt.js";
import { planTurn, shouldPlan } from "../agent/planner.js";
import { createConfirmer } from "../safety/confirm.js";
import { SkillRegistry, wireSkillsIndex } from "../skills/index.js";
import { SubagentRegistry, wireSubagentsIndex } from "../agent/subagentRegistry.js";
import { loadMemory, formatMemoryForPrompt } from "../agent/memory.js";
import { SlashCommandRegistry, resolveSlashCommand, formatHelp } from "../agent/slashCommands.js";
import { renderToolCall, renderToolDeclined, renderToolPlanned, renderError, renderText } from "./render.js";
import { LimitExceededError } from "../utils/errors.js";

export async function startRepl({
  provider,
  toolRegistry,
  config,
  logger,
  session,
  sessionStore,
  diffTracker,
  cwd,
  hookRegistry,
  permissionRules = [],
}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = createConfirmer({ config, logger });
  const contextManager = new ContextManager({ provider });
  const skillRegistry = new SkillRegistry({ cwd, logger });
  const { skillsIndex, skillsIndexMode } = wireSkillsIndex({ skillRegistry, toolRegistry, config });
  const subagentRegistry = new SubagentRegistry({ cwd, logger });
  const { subagentsIndex } = wireSubagentsIndex({ subagentRegistry, toolRegistry });
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
    skillRegistry,
    subagentRegistry,
  });

  const projectContext = await buildProjectContext(cwd);
  const memory = formatMemoryForPrompt(await loadMemory({ cwd }));
  const commandRegistry = new SlashCommandRegistry({ cwd, logger });

  renderText(`codeagent session ${session.id} — ${session.provider}/${session.model}`);
  renderText("Type your request, or Ctrl+C to exit.\n");

  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
  });

  while (true) {
    let userInput;
    try {
      userInput = await rl.question("> ");
    } catch {
      break; // stdin closed
    }
    if (!userInput.trim()) continue;

    const slashAction = resolveSlashCommand(userInput, { commandRegistry });
    if (slashAction.type === "help") {
      renderText(`\n${formatHelp(commandRegistry)}\n`);
      continue;
    }
    if (slashAction.type === "clear") {
      session.messages = [];
      renderText("Conversation history cleared.\n");
      continue;
    }
    if (slashAction.type === "plan-toggle") {
      // Mutates the same config object reference the Orchestrator holds
      // (this.config = config, not a copy) — no orchestrator.setConfig()
      // needed, planMode is already read fresh from config on every
      // tool dispatch (src/agent/orchestrator.js). Closes the PLAN.md
      // TODO that deferred this exact toggle until slash-command
      // recognition existed.
      config.planMode = !config.planMode;
      renderText(`Plan Mode ${config.planMode ? "enabled — destructive tools will describe, not execute" : "disabled"}.\n`);
      continue;
    }
    if (slashAction.type === "unknown") {
      renderText(`Unknown command: /${slashAction.name}. Try /help.\n`);
      continue;
    }
    if (slashAction.type === "prompt") {
      userInput = slashAction.text;
    }

    let plannerOutput = null;
    if (shouldPlan({ config, userRequest: userInput })) {
      plannerOutput = await planTurn({ provider, userRequest: userInput });
      if (plannerOutput) renderText(`\nPlan:\n${plannerOutput}\n`);
    }

    const system = buildSystemPrompt({
      projectContext,
      plannerOutput,
      customAddendum: config.customSystemPromptAddendum,
      adminPrompt: config.adminSystemPrompt,
      memory,
      skillsIndex,
      skillsIndexMode,
      subagentsIndex,
    });

    try {
      const result = await orchestrator.runTurn({
        messages: session.messages,
        userInput,
        system,
        cwd,
        onEvent: (event) => {
          if (event.type === "tool_call") renderToolCall(event.tool, event.input);
          if (event.type === "tool_declined") renderToolDeclined(event.tool, event.reason);
          if (event.type === "tool_blocked") renderToolDeclined(event.tool, `hook: ${event.reason}`);
          if (event.type === "tool_denied") renderToolDeclined(event.tool, `permission rule: ${event.rule.pattern}`);
          if (event.type === "tool_planned") renderToolPlanned(event.description);
          if (event.type === "final_text") renderText(`\n${event.text}\n`);
          if (event.type === "tool_error") renderError(`${event.tool}: ${event.error.message}`);
        },
      });

      session.messages = result.history;
      sessionStore.syncDiffTracker(session, diffTracker);
      await sessionStore.save(session);
    } catch (err) {
      if (err instanceof LimitExceededError) {
        renderError(err.message);
        await sessionStore.save(session);
      } else {
        renderError(err.message);
      }
    }

    if (interrupted) break;
  }

  rl.close();
}
