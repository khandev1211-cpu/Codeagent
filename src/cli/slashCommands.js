import fs from "fs";
import path from "path";

/**
 * Built-in slash commands definition
 */
export const BUILTIN_SLASH_COMMANDS = {
  "/help": {
    name: "/help",
    description: "List available slash commands",
    action: "help",
  },
  "/plan": {
    name: "/plan",
    description: "Toggle or enable Plan Mode (read-only action dry-runs)",
    action: "plan",
  },
  "/compact": {
    name: "/compact",
    description: "Compact context window history",
    action: "compact",
  },
  "/clear": {
    name: "/clear",
    description: "Clear terminal screen",
    action: "clear",
  },
  "/review": {
    name: "/review",
    description: "Review recent changes or specified files for quality and bugs",
    prompt: "Please review the code changes and codebase for potential bugs, security issues, performance bottlenecks, and style compliance. $ARG",
  },
  "/test": {
    name: "/test",
    description: "Run the test suite and fix any failing tests",
    prompt: "Please run the test suite, analyze any test failures, and fix the underlying issues. $ARG",
  },
};

/**
 * Discovers custom project slash commands from .codeagent/commands/*.md
 * 
 * @param {string} cwd 
 * @returns {Record<string, { name: string, description: string, prompt: string }>}
 */
export function discoverCustomSlashCommands(cwd) {
  const commands = {};
  const commandsDir = path.join(cwd, ".codeagent", "commands");

  if (fs.existsSync(commandsDir) && fs.statSync(commandsDir).isDirectory()) {
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const name = "/" + path.basename(file, ".md");
      const filePath = path.join(commandsDir, file);
      const raw = fs.readFileSync(filePath, "utf8").trim();

      // Parse optional description from first line if formatted as markdown header or comment
      let description = `Custom slash command from ${file}`;
      let prompt = raw;

      const lines = raw.split("\n");
      if (lines[0] && lines[0].startsWith("#")) {
        description = lines[0].replace(/^#+\s*/, "").trim();
        prompt = lines.slice(1).join("\n").trim();
      }

      commands[name] = { name, description, prompt };
    }
  }

  return commands;
}

/**
 * Handles slash command input in REPL.
 * 
 * @param {string} input - Raw input string starting with '/'
 * @param {{ cwd: string, config: object, renderText: function, renderError: function }} ctx
 * @returns {{ handled: boolean, expandedPrompt?: string, action?: string }}
 */
export function handleSlashCommand(input, { cwd, config, renderText, renderError } = {}) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { handled: false };
  }

  const spaceIdx = trimmed.indexOf(" ");
  const commandName = spaceIdx === -1 ? trimmed : trimmed.substring(0, spaceIdx);
  const arg = spaceIdx === -1 ? "" : trimmed.substring(spaceIdx + 1).trim();

  const customCommands = discoverCustomSlashCommands(cwd || process.cwd());
  const allCommands = { ...BUILTIN_SLASH_COMMANDS, ...customCommands };

  const cmd = allCommands[commandName];
  if (!cmd) {
    if (renderError) {
      renderError(`Unknown slash command: ${commandName}. Type /help to list available commands.`);
    }
    return { handled: true };
  }

  // Handle special built-in actions
  if (cmd.action === "help") {
    if (renderText) {
      renderText("\nAvailable Slash Commands:\n");
      for (const [name, meta] of Object.entries(allCommands)) {
        renderText(`  ${name.padEnd(14)} ${meta.description}`);
      }
      renderText("");
    }
    return { handled: true, action: "help" };
  }

  if (cmd.action === "clear") {
    if (console.clear) console.clear();
    return { handled: true, action: "clear" };
  }

  if (cmd.action === "plan") {
    config.planMode = !config.planMode;
    if (renderText) {
      renderText(`\nPlan Mode is now ${config.planMode ? "ENABLED (destructive tools will describe actions without executing)" : "DISABLED"}.\n`);
    }
    return { handled: true, action: "plan" };
  }

  if (cmd.action === "compact") {
    return { handled: true, action: "compact" };
  }

  // Handle prompt expansion commands
  if (cmd.prompt) {
    let expandedPrompt = cmd.prompt.replace(/\$ARG/g, arg);
    if (arg) {
      expandedPrompt = expandedPrompt.replace(/\$1/g, arg);
    }
    return { handled: true, expandedPrompt };
  }

  return { handled: false };
}
