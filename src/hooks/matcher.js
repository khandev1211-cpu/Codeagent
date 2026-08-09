/**
 * A hook's `matcher` is a pipe-separated list of tool names, e.g.
 * "write_file|edit_file". An omitted matcher (or "*") applies to every
 * tool. Events with no associated tool (SessionStart/SessionEnd) ignore
 * matcher entirely — see registry.js.
 */
export function hookMatches(matcher, toolName) {
  if (!matcher || matcher === "*") return true;
  return matcher
    .split("|")
    .map((s) => s.trim())
    .includes(toolName);
}
