import { discoverSlashCommands } from "./discoverSlashCommands.js";

// Built-in commands are handled specially by resolveSlashCommand — never
// overridable by a custom .codeagent/commands/<name>.md with the same
// name, same reasoning `run_subagent`/`skill_info` tool names aren't
// shadowable by a project's own tool definitions: a fixed vocabulary the
// user can rely on regardless of what a given project has configured.
const BUILTIN_NAMES = ["help", "clear", "plan"];

export class SlashCommandRegistry {
  constructor({ cwd = process.cwd(), logger, commands } = {}) {
    this.cwd = cwd;
    this._commands = commands || discoverSlashCommands({ cwd, logger });
  }

  list() {
    return this._commands;
  }

  get(name) {
    return this._commands.find((c) => c.name === name) || null;
  }
}

/**
 * Substitutes $ARGUMENTS in the template with whatever the user typed
 * after the command name. If the template has no $ARGUMENTS placeholder
 * but the user did supply arguments, they're appended at the end instead
 * of silently discarded — a custom command author who didn't anticipate
 * arguments shouldn't have them vanish just because they forgot the
 * placeholder.
 */
export function expandTemplate(template, args) {
  if (template.includes("$ARGUMENTS")) {
    return template.split("$ARGUMENTS").join(args);
  }
  return args ? `${template}\n\n${args}` : template;
}

/**
 * Parses a line of user input into a slash-command action, or signals
 * it's not a slash command at all so the caller passes it through to the
 * orchestrator unchanged. Deliberately synchronous and side-effect-free —
 * REPL/TUI callers own actually executing the resulting action (clearing
 * history, toggling config, rendering help, or substituting the expanded
 * prompt text) since that's session-state-mutation that differs between
 * the two entry points.
 */
export function resolveSlashCommand(input, { commandRegistry } = {}) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return { type: "none" };

  const spaceIdx = trimmed.indexOf(" ");
  const name = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase();
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  if (name === "help") return { type: "help" };
  if (name === "clear") return { type: "clear" };
  if (name === "plan") return { type: "plan-toggle" };

  const custom = commandRegistry?.get(name);
  if (!custom) {
    return { type: "unknown", name, builtins: BUILTIN_NAMES, available: commandRegistry?.list().map((c) => c.name) || [] };
  }

  return { type: "prompt", text: expandTemplate(custom.template, args), commandName: name };
}

/** Renders the /help listing: built-ins first, then discovered custom commands. */
export function formatHelp(commandRegistry) {
  const lines = [
    "Built-in commands:",
    "  /help    Show this list",
    "  /clear   Clear conversation history for this session",
    "  /plan    Toggle Plan Mode (read-only) for the rest of this session",
  ];
  const custom = commandRegistry?.list() || [];
  if (custom.length > 0) {
    lines.push("", "Custom commands (.codeagent/commands/):");
    for (const c of custom) lines.push(`  /${c.name}   ${c.description}`);
  }
  return lines.join("\n");
}
