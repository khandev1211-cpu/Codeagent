import { z } from "zod";
import { SubagentRunner } from "../agent/subagent.js";

export const runSubagentTool = {
  name: "run_subagent",
  description: "Delegate a sub-task to a specialized subagent (e.g. general-researcher or custom agents in .codeagent/agents/).",
  destructive: false,
  parameters: z.object({
    agent: z.string().describe("Name of the subagent to run (e.g. 'general-researcher')"),
    task: z.string().describe("Specific task or query for the subagent to execute"),
  }),

  async execute({ agent, task }, { cwd, config, logger }) {
    if (!config?.provider) {
      throw new Error("Provider instance is required to execute subagents.");
    }

    const runner = new SubagentRunner({
      provider: config.provider,
      config,
      logger,
      cwd,
    });

    const result = await runner.run({ agentName: agent, task });
    return `Subagent '${result.agent}' output:\n\n${result.summary}`;
  },
};
