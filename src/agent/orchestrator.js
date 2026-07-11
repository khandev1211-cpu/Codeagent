import { isDestructive } from "../safety/policy.js";
import { LimitExceededError, ToolError } from "../utils/errors.js";

/**
 * Runs one user turn to completion: send -> tool_use -> execute -> tool_result
 * -> repeat, until the model returns plain text with no tool calls, or a
 * hard limit is hit (doc 02 / doc 04).
 */
export class Orchestrator {
  constructor({ provider, toolRegistry, confirm, config, logger, contextManager, diffTracker }) {
    this.provider = provider;
    this.toolRegistry = toolRegistry;
    this.confirm = confirm;
    this.config = config;
    this.logger = logger;
    this.contextManager = contextManager;
    this.diffTracker = diffTracker;
  }

  async runTurn({ messages, userInput, system, cwd, onEvent = () => {} }) {
    const history = [...messages, { role: "user", content: userInput }];
    let iterations = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    while (true) {
      if (iterations >= this.config.maxIterationsPerTurn) {
        throw new LimitExceededError(
          `Hit max iterations per turn (${this.config.maxIterationsPerTurn}). Session is saved; you can raise the limit in config or resume.`,
          { limit: this.config.maxIterationsPerTurn, current: iterations }
        );
      }

      const compacted = this.contextManager
        ? await this.contextManager.maybeCompact(history)
        : history;

      let response;
      try {
        response = await this.provider.send(compacted, this.toolRegistry.schemas(), { system });
      } catch (err) {
        // Provider call failed after its own internal retries — end the
        // turn with a clear error rather than looping forever (doc 04).
        onEvent({ type: "provider_error", error: err });
        throw err;
      }

      totalInputTokens += response.usage?.inputTokens || 0;
      totalOutputTokens += response.usage?.outputTokens || 0;

      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      const textBlocks = response.content.filter((b) => b.type === "text");

      if (toolUseBlocks.length === 0) {
        // Plain text only -> final answer for this turn.
        history.push({ role: "assistant", content: response.content });
        onEvent({ type: "final_text", text: textBlocks.map((b) => b.text).join("\n") });
        return {
          history,
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
          iterations,
        };
      }

      history.push({ role: "assistant", content: response.content });

      const toolResultContent = [];
      for (const block of toolUseBlocks) {
        const tool = this.toolRegistry.get(block.name);
        if (!tool) {
          toolResultContent.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Unknown tool: ${block.name}`,
            is_error: true,
          });
          continue;
        }

        onEvent({ type: "tool_call", tool: tool.name, input: block.input });

        const decision = await this.confirm(tool, block.input);
        if (!decision.allowed) {
          onEvent({ type: "tool_declined", tool: tool.name, reason: decision.reason });
          toolResultContent.push({
            type: "tool_result",
            tool_use_id: block.id,
            content:
              decision.reason === "no-tty"
                ? "Declined: no interactive terminal available to confirm this destructive action, and --yolo was not passed."
                : "The user declined this action.",
            is_error: true,
          });
          continue;
        }

        let result;
        try {
          result = await tool.execute(block.input, {
            cwd,
            config: this.config,
            diffTracker: this.diffTracker,
            logger: this.logger,
          });
        } catch (err) {
          // Caught at the loop level, converted into a tool_result the model
          // can see and react to — not swallowed, not a crashed session (doc 04).
          const toolErr = new ToolError(err.message, { toolName: tool.name });
          this.logger?.error(`Tool execution error: ${tool.name}`, { message: err.message });
          onEvent({ type: "tool_error", tool: tool.name, error: toolErr });
          toolResultContent.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Tool error: ${err.message}`,
            is_error: true,
          });
          continue;
        }

        onEvent({ type: "tool_result", tool: tool.name, result });
        toolResultContent.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
          is_error: result?.ok === false,
        });
      }

      history.push({ role: "user", content: toolResultContent });
      iterations += 1;
    }
  }
}
