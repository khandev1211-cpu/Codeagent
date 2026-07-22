const BASE_TEMPLATE = `You are codeagent, a terminal-native AI coding agent. You have direct tool access to read, write, and edit files, search the codebase, and run shell commands in the user's project.

Conventions:
- Prefer edit_file for small, targeted changes over rewriting whole files with write_file.
- Before making changes, read enough of the relevant files to understand existing conventions.
- Destructive actions (write_file, edit_file, run_bash) require user confirmation unless the user explicitly ran with --yolo. Expect that a call may be declined; if so, adjust your plan rather than repeating the same call.
- Be direct in your explanations. Show what you're doing, not a play-by-play of your reasoning.`;

function renderAdminPrompt(adminPrompt) {
  // "Priority" here means: takes precedence over project context, planner
  // output, and any per-project customSystemPromptAddendum below. It does
  // NOT mean priority over the tool-use conventions above, and it has no
  // bearing on the Safety Layer or Hooks at all — those are enforced in
  // code (safety/confirm.js, hooks/registry.js), independent of anything
  // any system prompt says, admin-set or otherwise (docs/18).
  return `## Standing instructions from the administrator (priority)\nSet once via "codeagent setup" or "codeagent system-prompt set", these apply across every project on this machine and take priority over the project context and any other instructions below — follow them unless they conflict with the tool-use conventions above.\n\n${adminPrompt}`;
}

function renderSkillsIndex(skillsIndex) {
  return `## Available skills\nThese are optional, discoverable instructions for specific kinds of tasks. Read a skill's file (via read_file) only if it's actually relevant to what you're doing right now — don't read all of them preemptively, and don't mention this list to the user unless it's relevant.\n\n${skillsIndex}`;
}

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
 * planner output) (doc 04). Order matters here: base conventions first
 * (the agent needs to know how to use its tools before anything else),
 * then the admin's standing instructions (docs/18 — global, priority, but
 * not a full replacement), then what capabilities exist (skills — docs/19,
 * an index only, never full skill content), then everything project-
 * specific.
 */
export function buildSystemPrompt({ projectContext, plannerOutput, customAddendum, adminPrompt, skillsIndex, projectMemory }) {
  const parts = [BASE_TEMPLATE];
  if (adminPrompt) parts.push(renderAdminPrompt(adminPrompt));
  if (skillsIndex) parts.push(renderSkillsIndex(skillsIndex));
  if (projectMemory) parts.push(projectMemory);
  if (projectContext) parts.push(renderProjectContext(projectContext));
  if (plannerOutput) parts.push(`## Current plan\n${plannerOutput}`);
  if (customAddendum) parts.push(`## Additional instructions\n${customAddendum}`);
  return parts.join("\n\n");
}
