/**
 * Named color schemes for the TUI (docs/28), not arbitrary hex
 * customization — a small, curated set is the smaller, actually-useful
 * v1 of "theming": most people want "the default," "something that
 * works on a light background / limited-color terminal," or "higher
 * contrast," not a color picker. Named colors also stay terminal-safe:
 * ink/chalk fall back gracefully for named colors on terminals with
 * fewer than 16.7M colors, where an arbitrary hex value might not.
 *
 * Every theme defines the same semantic keys (`accent`, `muted`,
 * `success`, `warning`, `error`) — components read theme.accent, never a
 * hardcoded color string, so switching themes needs no changes to
 * StatusHeader/SessionLog/InputBox beyond what's already there.
 */
export const THEMES = {
  default: {
    accent: "#d97757",
    muted: "gray",
    success: "green",
    warning: "yellow",
    error: "red",
  },
  // For terminals with limited/no color support, or anyone who finds
  // color distracting — every semantic role maps to a shade of white/
  // gray/dim rather than a hue, so nothing is lost structurally (bold vs
  // dim vs plain still distinguishes roles), just the color is gone.
  monochrome: {
    accent: "white",
    muted: "gray",
    success: "white",
    warning: "white",
    error: "white",
  },
  // Brighter, more saturated variants for low-vision users or terminals
  // with a light/bright background where the default palette's muted
  // tones (especially gray-on-gray) can be hard to distinguish.
  "high-contrast": {
    accent: "#ffcc00",
    muted: "gray",
    success: "#00ff00",
    warning: "#ffaa00",
    error: "#ff5555",
  },
};

/** Falls back to "default" for an unknown/unset theme name rather than throwing — a bad or stale config value shouldn't crash the TUI on startup. */
export function getTheme(name) {
  return THEMES[name] || THEMES.default;
}
