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
import { recordTurnUsage } from "../utils/usageTracker.js";
import { connectAllMcpServers, closeAllMcpClients } from "../mcp/index.js";
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
  usageTracker,
}) {
  const confirm = createConfirmer({ config, logger });
  const contextManager = new ContextManager({ provider });
  const skillRegistry = new SkillRegistry({ cwd, logger });
  const { skillsIndex, skillsIndexMode } = wireSkillsIndex({ skillRegistry, toolRegistry, config });
  const subagentRegistry = new SubagentRegistry({ cwd, logger });
  const { subagentsIndex } = wireSubagentsIndex({ subagentRegistry, toolRegistry });
  const { clients: mcpClients } = await connectAllMcpServers({ cwd, logger, toolRegistry });
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

  // Created only now, immediately before the loop starts asking
  // questions — NOT at the top of this function. `readline.createInterface`
  // starts actively consuming `process.stdin` the moment it's constructed;
  // every `await` above (MCP connection, project context, memory files)
  // takes real time, and piped/non-TTY input (a test harness, CI, someone
  // scripting `echo "..." | codeagent`) can arrive and be silently
  // consumed by the interface during that window, before any
  // `rl.question()` call is pending to actually receive it — losing the
  // first line entirely. Real interactive typing at a TTY never triggers
  // this (a human can't type faster than the setup above completes), so
  // it went unnoticed until a fresh, from-scratch run through this exact
  // scenario surfaced it.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  renderText(`codeagent session ${session.id} — ${session.provider}/${session.model}`);
  renderText("Type your request, or Ctrl+C to exit.\n");

  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
  });

  // `for await...of rl` can yield its final buffered line at (or after)
  // the moment the underlying stream hits EOF and the interface
  // auto-closes itself — whether that close has fully landed before this
  // loop body's own `rl.prompt()` call runs is a genuine race, not
  // deterministic across Node versions or even just event-loop timing
  // between runs (observed directly: passed locally, failed in CI with
  // `ERR_USE_AFTER_CLOSE` on the very same code). A real interactive TTY
  // session never triggers this — a live terminal's stdin doesn't hit
  // EOF mid-conversation — so this is specifically about piped/scripted
  // input (the same category of thing the interface-creation-timing fix
  // above addresses). `safePrompt` makes every prompt call a no-op once
  // the interface is confirmed closed, instead of assuming it's still
  // safe to write to.
  let rlClosed = false;
  rl.on("close", () => {
    rlClosed = true;
  });
  function safePrompt() {
    if (!rlClosed) rl.prompt();
  }

  rl.setPrompt("> ");
  safePrompt();

  // `for await...of rl` (Node's documented async-iterator pattern for
  // readline), not a `while(true) { await rl.question(...) }` loop — the
  // latter has a genuine, reproducible limitation with fully-buffered,
  // immediately-closing piped input (verified directly against a
  // minimal readline/promises repro): only the FIRST line ever gets
  // delivered through nested `question()` calls; a second `question()`
  // call made after the stream has already ended never resolves or
  // rejects at all. `for await` is driven by the interface's 'line'
  // events directly and correctly delivers every already-buffered line
  // regardless of that timing. `rl.prompt()` (not `question()`'s
  // built-in prompt display) shows the "> " text now, called once before
  // the loop and again after every iteration — the trade-off for
  // switching mechanisms is that prompt display is no longer automatic,
  // so every exit point in the loop body below explicitly re-prompts.
  for await (const rawInput of rl) {
    let userInput = rawInput;
    if (!userInput.trim()) {
      safePrompt();
      continue;
    }

    const slashAction = resolveSlashCommand(userInput, { commandRegistry });
    if (slashAction.type === "help") {
      renderText(`\n${formatHelp(commandRegistry)}\n`);
      safePrompt();
      continue;
    }
    if (slashAction.type === "clear") {
      session.messages = [];
      renderText("Conversation history cleared.\n");
      safePrompt();
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
      safePrompt();
      continue;
    }
    if (slashAction.type === "unknown") {
      renderText(`Unknown command: /${slashAction.name}. Try /help.\n`);
      safePrompt();
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
      autonomousMode: Boolean(config.autonomousMode),
    });

    try {
      const result = await orchestrator.runTurn({
        messages: session.messages,
        userInput,
        system,
        cwd,
        plan: plannerOutput,
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
      if (usageTracker) {
        const quotaStatus = await recordTurnUsage({ usageTracker, cwd, config, usage: result.usage });
        if (quotaStatus?.overQuota) {
          renderText(`(quota) ${quotaStatus.provider} estimated spend this month: $${quotaStatus.spent.toFixed(2)} / $${quotaStatus.limit} limit.\n`);
        }
      }
    } catch (err) {
      if (err instanceof LimitExceededError) {
        renderError(err.message);
        await sessionStore.save(session);
      } else {
        renderError(err.message);
      }
    }

    if (interrupted) break;
    safePrompt();
  }

  rl.close();
  await closeAllMcpClients(mcpClients);
}
