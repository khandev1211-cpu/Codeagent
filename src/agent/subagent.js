import { ToolRegistry } from "../tools/registry.js";

/**
 * Builds the tool registry a subagent actually runs with. Two rules,
 * both from docs/22:
 *
 * 1. `run_subagent` is always excluded, regardless of what the
 *    definition's `tools` field says — this is the v1 recursion
 *    boundary. A subagent cannot spawn a subagent.
 * 2. If the definition specifies `tools`, the result is that list
 *    INTERSECTED with what the parent registry actually has — a
 *    definition can narrow, never grant a tool the parent doesn't have.
 *    An unknown name in `tools` is silently dropped rather than erroring,
 *    matching "narrowing" semantics: asking for a tool that doesn't
 *    exist just means fewer tools, not a broken subagent.
 */
export function buildRestrictedToolRegistry(parentToolRegistry, allowedToolNames) {
  const parentTools = parentToolRegistry.list().filter((t) => t.name !== "run_subagent");
  const scoped = allowedToolNames
    ? parentTools.filter((t) => allowedToolNames.includes(t.name))
    : parentTools;
  return new ToolRegistry(scoped);
}

/**
 * The subagent's system prompt is just its own instructions body —
 * deliberately NOT composed with the parent's system prompt (project
 * context, admin prompt, skills index, etc.). "No visibility into the
 * parent conversation beyond what's explicitly passed in" (docs/22)
 * applies to the system prompt too, not just message history — a
 * subagent is a fresh, scoped context, not the parent's context plus an
 * addendum.
 */
export function buildSubagentSystemPrompt(definition) {
  return definition.instructions;
}
