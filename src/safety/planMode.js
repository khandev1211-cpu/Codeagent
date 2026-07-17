import { summarizeCall } from "./confirm.js";

/**
 * Plan Mode intercepts destructive tool calls before they reach
 * `tool.execute()` at all — not a confirmation the model can talk its way
 * past, a structural guarantee that `fs.writeFile`/`spawn`/etc. are never
 * called while it's active. Non-destructive tools (read_file, list_dir,
 * search_code) are unaffected — the model still needs to be able to
 * explore the project while planning; only "would this succeed" is
 * synthesized for actions that would change something (docs/20).
 *
 * Reuses `summarizeCall` (safety/confirm.js) rather than duplicating
 * per-tool description logic — the same text a human would see in the
 * interactive confirm prompt, just prefixed to make clear nothing
 * actually happened.
 */
export function describePlannedAction(toolName, input) {
  return `[plan mode — not executed] ${summarizeCall(toolName, input)}`;
}
