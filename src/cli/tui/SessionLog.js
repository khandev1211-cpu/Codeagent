import { Box, Text } from "ink";
import { h } from "./h.js";
import { THEMES } from "./theme.js";

/**
 * `entries` is a flat array the App builds from onEvent callbacks plus
 * user/assistant text, each `{ type, ...}` — kept as plain data (not React
 * state mutated in place) so it's trivial to test what SessionLog renders
 * for a given input, independent of how App accumulates it.
 */
export function SessionLog({ entries, theme = THEMES.default }) {
  return h(
    Box,
    { flexDirection: "column" },
    entries.map((entry, i) => h(LogEntry, { key: i, entry, theme }))
  );
}

function LogEntry({ entry, theme }) {
  if (entry.type === "user_message") {
    return h(Box, { marginBottom: 1 }, h(Text, { color: theme.muted }, "› "), h(Text, null, entry.text));
  }
  if (entry.type === "assistant_text") {
    return h(Box, { marginBottom: 1 }, h(Text, { color: theme.muted }, entry.text));
  }
  if (entry.type === "tool_call") {
    return h(
      Box,
      { borderStyle: "single", borderLeft: true, borderTop: false, borderBottom: false, borderRight: false, borderColor: statusColor(entry.status, theme), paddingLeft: 1, marginBottom: 1 },
      h(Text, { color: theme.accent }, "● "),
      h(Text, null, `${entry.tool} `),
      h(Text, { color: theme.muted }, entry.detail || ""),
      entry.status ? h(Text, { color: statusColor(entry.status, theme) }, "  " + statusLabel(entry.status)) : null
    );
  }
  return null;
}

function statusColor(status, theme) {
  if (status === "confirmed" || status === "allowed") return theme.success;
  if (status === "declined" || status === "denied") return theme.warning;
  if (status === "planned") return theme.muted;
  return theme.muted;
}

function statusLabel(status) {
  if (status === "confirmed") return "confirmed";
  if (status === "allowed") return "allowed by rule";
  if (status === "declined") return "declined";
  if (status === "denied") return "denied by rule";
  if (status === "planned") return "planned, not executed";
  return status;
}
