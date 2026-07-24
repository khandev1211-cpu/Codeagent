import { Box, Text } from "ink";
import { h } from "./h.js";

/**
 * `entries` is a flat array the App builds from onEvent callbacks plus
 * user/assistant text, each `{ type, ...}` — kept as plain data (not React
 * state mutated in place) so it's trivial to test what SessionLog renders
 * for a given input, independent of how App accumulates it.
 */
export function SessionLog({ entries }) {
  return h(
    Box,
    { flexDirection: "column" },
    entries.map((entry, i) => h(LogEntry, { key: i, entry }))
  );
}

function LogEntry({ entry }) {
  if (entry.type === "user_message") {
    return h(Box, { marginBottom: 1 }, h(Text, { color: "gray" }, "› "), h(Text, null, entry.text));
  }
  if (entry.type === "assistant_text") {
    return h(Box, { marginBottom: 1 }, h(Text, { color: "gray" }, entry.text));
  }
  if (entry.type === "tool_call") {
    return h(
      Box,
      { borderStyle: "single", borderLeft: true, borderTop: false, borderBottom: false, borderRight: false, borderColor: statusColor(entry.status), paddingLeft: 1, marginBottom: 1 },
      h(Text, { color: "#d97757" }, "● "),
      h(Text, null, `${entry.tool} `),
      h(Text, { color: "gray" }, entry.detail || ""),
      entry.status ? h(Text, { color: statusColor(entry.status) }, "  " + statusLabel(entry.status)) : null
    );
  }
  return null;
}

function statusColor(status) {
  if (status === "confirmed" || status === "allowed") return "green";
  if (status === "declined" || status === "denied") return "yellow";
  if (status === "planned") return "gray";
  return "gray";
}

function statusLabel(status) {
  if (status === "confirmed") return "confirmed";
  if (status === "allowed") return "allowed by rule";
  if (status === "declined") return "declined";
  if (status === "denied") return "denied by rule";
  if (status === "planned") return "planned, not executed";
  return status;
}
