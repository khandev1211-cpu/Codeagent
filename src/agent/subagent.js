import fs from "fs";
import path from "path";
import { parseFrontmatter } from "../skills/frontmatter.js";
import { Orchestrator } from "./orchestrator.js";
import { ToolRegistry } from "../tools/registry.js";
import { createDefaultRegistry } from "../tools/index.js";

/**
 * Discovers subagent definitions from .codeagent/agents/*.md
 * 
 * @param {string} cwd 
 * @returns {Record<string, { name: string, description: string, allowedTools?: string[], prompt: string, path: string }>}
 */
export function discoverSubagents(cwd) {
  const subagents = {};
  const agentsDir = path.join(cwd, ".codeagent", "agents");

  if (fs.existsSync(agentsDir) && fs.statSync(agentsDir).isDirectory()) {
    const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(agentsDir, file);
      const raw = fs.readFileSync(filePath, "utf8");
      const { frontmatter, body } = parseFrontmatter(raw);
      const metadata = frontmatter || {};

      const name = metadata.name || path.basename(file, ".md");
      const description = metadata.description || `Subagent ${name}`;
      const allowedToolsRaw = metadata["allowed-tools"] || metadata.allowedTools;
      const allowedTools = Array.isArray(allowedToolsRaw)
        ? allowedToolsRaw
        : typeof allowedToolsRaw === "string"
        ? allowedToolsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

      subagents[name] = {
        name,
        description,
        allowedTools,
        prompt: body,
        path: filePath,
      };
    }
  }

  return subagents;
}

/**
 * Executes a child subagent with an isolated history and restricted tool registry.
 */
export class SubagentRunner {
  constructor({ provider, config, logger, cwd }) {
    this.provider = provider;
    this.config = config;
    this.logger = logger;
    this.cwd = cwd;
  }

  async run({ agentName, task, confirm }) {
    const availableAgents = discoverSubagents(this.cwd);

    // Fallback built-in agent definitions if not present on disk
    let agentDef = availableAgents[agentName];
    if (!agentDef) {
      if (agentName === "general-researcher") {
        agentDef = {
          name: "general-researcher",
          description: "General research subagent",
          allowedTools: ["read_file", "search_code", "list_dir"],
          prompt: "You are a subagent focused on codebase research and analysis. Gather relevant information and present a clear summary.",
        };
      } else {
        throw new Error(`Unknown subagent: '${agentName}'. Available subagents: ${Object.keys(availableAgents).join(", ") || "general-researcher"}`);
      }
    }

    // Build scoped tool registry
    const defaultRegistry = createDefaultRegistry();
    const scopedRegistry = new ToolRegistry();

    if (agentDef.allowedTools && agentDef.allowedTools.length > 0) {
      for (const toolName of agentDef.allowedTools) {
        const tool = defaultRegistry.get(toolName);
        if (tool) scopedRegistry.register(tool);
      }
    } else {
      // Default to read-only tools if unspecified
      for (const toolName of ["read_file", "search_code", "list_dir"]) {
        const tool = defaultRegistry.get(toolName);
        if (tool) scopedRegistry.register(tool);
      }
    }

    const orchestrator = new Orchestrator({
      provider: this.provider,
      toolRegistry: scopedRegistry,
      confirm: confirm || (async () => ({ allowed: true })),
      config: { ...this.config, maxIterationsPerTurn: 5 },
      logger: this.logger,
    });

    const systemPrompt = `You are a subagent named '${agentDef.name}'.\n${agentDef.prompt}\n\nTask: ${task}`;

    const result = await orchestrator.runTurn({
      messages: [],
      userInput: task,
      system: systemPrompt,
      cwd: this.cwd,
    });

    const finalTextBlock = result.history
      .filter((m) => m.role === "assistant")
      .map((m) => (Array.isArray(m.content) ? m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") : m.content))
      .filter(Boolean)
      .pop();

    return {
      agent: agentDef.name,
      summary: finalTextBlock || "Subagent completed execution with no text output.",
      usage: result.usage,
    };
  }
}
