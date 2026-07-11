const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

/** No color codes emitted when output isn't a TTY (doc 10). */
function colorize(text, color, output = process.stdout) {
  if (!output.isTTY) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export function renderToolCall(toolName, input, output = process.stdout) {
  const detail = input?.path || input?.command || "";
  output.write(colorize(`→ ${toolName}${detail ? ` ${detail}` : ""}\n`, "cyan", output));
}

export function renderToolDeclined(toolName, reason, output = process.stdout) {
  output.write(colorize(`✗ ${toolName} declined (${reason})\n`, "yellow", output));
}

export function renderError(message, output = process.stderr) {
  output.write(colorize(`Error: ${message}\n`, "red", output));
}

export function renderText(text, output = process.stdout) {
  output.write(`${text}\n`);
}

export function renderDiffPreview(oldStr, newStr, output = process.stdout) {
  output.write(colorize(`--- old\n${oldStr}\n`, "red", output));
  output.write(colorize(`+++ new\n${newStr}\n`, "green", output));
}
