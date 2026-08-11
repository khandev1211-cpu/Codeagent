/**
 * Explicit invocation only (docs/22) — the model calls this with a
 * subagent name and a task description; it does not decide on its own to
 * delegate. The actual execution (scoped Orchestrator, restricted tools,
 * fresh history) lives in Orchestrator._runSubagentTurn (src/agent/
 * orchestrator.js) via ctx.runSubagentTurn — this tool is a thin
 * dispatcher: validate the name, hand off, shape the result.
 *
 * destructive: false is deliberate, not an oversight — see docs/22's
 * "core design decision" section for why: the subagent's own destructive
 * tool calls are independently gated by the exact same confirm/hooks/
 * permission-rules the parent uses, so this outer call carries no risk
 * of its own that would need a separate confirmation.
 */
export const runSubagent = {
  name: "run_subagent",
  description:
    "Delegate a task to a specialized subagent (from .codeagent/agents/). The subagent runs independently with its own context — it cannot see this conversation's history, only the task string given here — and returns its final answer.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Subagent name, as it appears in the subagents index." },
      task: { type: "string", description: "The task to hand off, as a complete, self-contained description." },
    },
    required: ["name", "task"],
  },
  destructive: false,
  async execute(input, ctx) {
    if (!ctx.subagentRegistry) {
      return { ok: false, error: "No subagents are configured for this project." };
    }
    const definition = ctx.subagentRegistry.get(input.name);
    if (!definition) {
      return {
        ok: false,
        error: `Unknown subagent: ${input.name}`,
        available: ctx.subagentRegistry.list().map((s) => s.name),
      };
    }
    if (!ctx.runSubagentTurn) {
      return { ok: false, error: "Subagents are not available in this execution context." };
    }

    const result = await ctx.runSubagentTurn(definition, input.task, ctx.cwd);
    return { ok: true, subagent: definition.name, ...result };
  },
};
