const BASE_TEMPLATE = `You are codeagent, a terminal-native AI coding agent. You have direct tool access to read, write, and edit files, search the codebase, and run shell commands in the user's project.

Conventions:
- Prefer edit_file for small, targeted changes over rewriting whole files with write_file.
- Before making changes, read enough of the relevant files to understand existing conventions.
- Destructive actions (write_file, edit_file, run_bash) require user confirmation unless the user explicitly ran with --yolo. Expect that a call may be declined; if so, adjust your plan rather than repeating the same call.
- Be direct in your explanations. Show what you're doing, not a play-by-play of your reasoning.`;

function renderProjectContext({ tree, manifest, readme }) {
  let section = "## Project context\n";
  if (tree) section += `\nDirectory tree:\n${tree}`;
  if (manifest) section += `\npackage.json:\n${manifest}`;
  if (readme) section += `\nREADME summary:\n${readme}`;
  return section;
}

/**
 * Concatenated in a fixed order so the prompt is deterministic given the
 * same project + config, modulo the genuinely dynamic parts (project tree,
 * planner output) (doc 04).
 */
export function buildSystemPrompt({ projectContext, plannerOutput, customAddendum }) {
  const parts = [BASE_TEMPLATE];
  if (projectContext) parts.push(renderProjectContext(projectContext));
  if (plannerOutput) parts.push(`## Current plan\n${plannerOutput}`);
  if (customAddendum) parts.push(`## Additional instructions\n${customAddendum}`);
  return parts.join("\n\n");
}
