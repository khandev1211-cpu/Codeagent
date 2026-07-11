import readline from "node:readline/promises";
import { Orchestrator } from "../agent/orchestrator.js";
import { ContextManager, buildProjectContext } from "../agent/context.js";
import { buildSystemPrompt } from "../agent/systemPrompt.js";
import { planTurn, shouldPlan } from "../agent/planner.js";
import { createConfirmer } from "../safety/confirm.js";
import { renderToolCall, renderToolDeclined, renderError, renderText } from "./render.js";
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
}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = createConfirmer({ config, logger });
  const contextManager = new ContextManager({ provider });
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

    let plannerOutput = null;
    if (shouldPlan({ config, userRequest: userInput })) {
      plannerOutput = await planTurn({ provider, userRequest: userInput });
      if (plannerOutput) renderText(`\nPlan:\n${plannerOutput}\n`);
    }

    const system = buildSystemPrompt({
      projectContext,
      plannerOutput,
      customAddendum: config.customSystemPromptAddendum,
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
