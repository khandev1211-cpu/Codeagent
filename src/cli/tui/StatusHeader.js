import { Box, Text } from "ink";
import { h } from "./h.js";
import { THEMES } from "./theme.js";

/**
 * The persistent top-of-screen status strip. Everything here is a live
 * read of real state (session.config, skillRegistry, permissionRules) —
 * nothing is hardcoded, unlike the mock-data version this was designed
 * from. See App.js for where these props actually come from.
 */
export function StatusHeader({ model, provider, planMode, skillsCount, rulesCount, cwd, theme = THEMES.default }) {
  return h(
    Box,
    { flexDirection: "column", marginBottom: 1 },
    h(
      Box,
      null,
      h(Text, { color: theme.accent, bold: true }, "✳ "),
      h(Text, null, model),
      h(Text, { color: theme.muted }, "  " + provider),
      h(Text, { color: theme.muted }, "   Tab to switch")
    ),
    h(
      Box,
      { borderStyle: "single", borderColor: theme.muted, borderTop: false, borderLeft: false, borderRight: false, paddingBottom: 0 },
      h(Text, { color: theme.muted, dimColor: true }, `plan mode: ${planMode ? "on" : "off"}`),
      h(Text, { color: theme.muted, dimColor: true }, `   ${skillsCount} skills`),
      h(Text, { color: theme.muted, dimColor: true }, `   ${rulesCount} rules active`),
      h(Text, { color: theme.muted, dimColor: true }, `   ${cwd}`)
    )
  );
}
