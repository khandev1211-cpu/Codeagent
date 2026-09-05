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

function renderMemory(memoryText) {
  // The CLAUDE.md-equivalent gap (docs/16, docs/23): user-authored,
  // discoverable instructions, distinct from the admin prompt (operator-
  // set, machine-wide) above it and the auto-generated project context
  // (README/tree, mechanical, no editorial voice) below it. Sits between
  // the two: more specific than "standing administrator instructions",
  // more intentional/curated than "here's what package.json says".
  return `## Project & personal instructions (AGENTS.md)\nThe following was authored by the user or team specifically to guide how you work in this project — treat it with real weight, but it doesn't override the tool-use conventions above or the Safety Layer (enforced in code, independent of any system prompt content).\n\n${memoryText}`;
}

function renderSkillsIndex(skillsIndex, skillsIndexMode) {
  if (skillsIndexMode === "compact") {
    return `## Available skills (names only)\nThese are optional, discoverable instructions for specific kinds of tasks: ${skillsIndex}.\nIf a name looks relevant to what you're doing right now, call skill_info with that name to get its description and file path, then read the file (via read_file) only if it turns out to actually be relevant. Don't call skill_info for every name preemptively, and don't mention any of this to the user unless it's relevant.`;
  }
  return `## Available skills\nThese are optional, discoverable instructions for specific kinds of tasks. Read a skill's file (via read_file) only if it's actually relevant to what you're doing right now — don't read all of them preemptively, and don't mention this list to the user unless it's relevant.\n\n${skillsIndex}`;
}

/**
 * Full inline index, not two-tier — docs/22's "System prompt footprint"
 * explains why this doesn't need Skills' compact treatment. Call
 * run_subagent explicitly rather than the model narrating what it's
 * about to delegate, matching how the skills section already tells the
 * model not to narrate its own tool-selection process to the user.
 */
function renderSubagentsIndex(subagentsIndex) {
  return `## Available subagents\nThese are specialized subagents you can delegate a self-contained task to via run_subagent. A subagent has no visibility into this conversation — give it a complete, standalone task description. Only delegate when it's a genuine fit for a listed subagent's purpose; otherwise just do the task yourself.\n\n${subagentsIndex}`;
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
/**
 * Autonomous Mode only (docs/31) — instruction-only, no new tool or
 * code-level enforcement, same category as the admin prompt/memory
 * sections above: guidance the model is told to take seriously, not a
 * gate. Placed right after the current plan, when one exists, so the
 * "verify before finishing" instruction reads naturally as the last
 * step of the plan just shown.
 */
function renderAutonomousMode() {
  return `## Autonomous Mode\nYou are operating without step-by-step confirmation — destructive actions are pre-approved for this session, but the same safety mechanisms underneath (sandboxing, write-path restrictions, hooks) are unchanged and still apply. Because there's no one confirming each step as you go:\n- Work through your plan yourself; don't stop to ask the user clarifying questions unless you are genuinely blocked (e.g. missing credentials, an ambiguous requirement with materially different implementations).\n- Before declaring the task done, verify your own work: run the test suite if one exists, run linting if configured, actually execute what you built rather than assuming it works.\n- End with one clear summary: what you built, what you verified, and how the user can check it themselves — not a play-by-play of every step.`;
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
export function buildSystemPrompt({
  projectContext,
  plannerOutput,
  customAddendum,
  adminPrompt,
  memory,
  skillsIndex,
  skillsIndexMode = "full",
  subagentsIndex,
  autonomousMode = false,
}) {
  const parts = [BASE_TEMPLATE];
  if (adminPrompt) parts.push(renderAdminPrompt(adminPrompt));
  if (memory) parts.push(renderMemory(memory));
  if (skillsIndex) parts.push(renderSkillsIndex(skillsIndex, skillsIndexMode));
  if (subagentsIndex) parts.push(renderSubagentsIndex(subagentsIndex));
  if (projectContext) parts.push(renderProjectContext(projectContext));
  if (plannerOutput) parts.push(`## Current plan\n${plannerOutput}`);
  if (autonomousMode) parts.push(renderAutonomousMode());
  if (customAddendum) parts.push(`## Additional instructions\n${customAddendum}`);
  return parts.join("\n\n");
}
