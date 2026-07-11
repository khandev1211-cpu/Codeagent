import readline from "node:readline/promises";
import { isDestructive } from "./policy.js";
import { shouldBypassConfirmation, logBypass } from "./yolo.js";

function summarizeCall(toolName, input) {
  if (toolName === "write_file") {
    return `write_file -> ${input.path} (${Buffer.byteLength(input.content || "", "utf-8")} bytes)`;
  }
  if (toolName === "edit_file") {
    return `edit_file -> ${input.path}\n--- old ---\n${input.old_content}\n--- new ---\n${input.new_content}`;
  }
  if (toolName === "run_bash") {
    return `run_bash -> ${input.command}${input.cwd ? ` (cwd: ${input.cwd})` : ""}`;
  }
  return `${toolName} -> ${JSON.stringify(input)}`;
}

/**
 * Confirmation gate for a single tool call. `rememberedThisSession` is a
 * Set the caller owns and passes in — "allow and remember" is scoped to the
 * current session only, never persisted across sessions (doc 07).
 */
export function createConfirmer({ config, logger, input = process.stdin, output = process.stdout } = {}) {
  const remembered = new Set();

  return async function confirm(tool, toolInput) {
    if (!isDestructive(tool)) {
      return { allowed: true };
    }

    if (shouldBypassConfirmation(config)) {
      logBypass(logger, { toolName: tool.name, input: toolInput });
      return { allowed: true, bypassed: true };
    }

    if (remembered.has(tool.name)) {
      return { allowed: true, remembered: true };
    }

    if (!input.isTTY) {
      // No human available to ask and --yolo wasn't passed — this is a
      // failure condition for one-shot/CI usage (doc 10), not a silent allow.
      return { allowed: false, reason: "no-tty" };
    }

    const rl = readline.createInterface({ input, output });
    try {
      output.write(`\n${summarizeCall(tool.name, toolInput)}\n`);
      const answer = (
        await rl.question("Allow this action? [y]es / [n]o / [a]lways this session: ")
      )
        .trim()
        .toLowerCase();

      if (answer === "a" || answer === "always") {
        remembered.add(tool.name);
        return { allowed: true };
      }
      if (answer === "y" || answer === "yes") {
        return { allowed: true };
      }
      return { allowed: false, reason: "declined" };
    } finally {
      rl.close();
    }
  };
}
