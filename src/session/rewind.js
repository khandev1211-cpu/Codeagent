/**
 * Conversation rewind: cut a conversation back to an earlier turn.
 *
 * A "turn" starts at a real user message. Tool results are ALSO stored as
 * role:"user" messages (an array of tool_result blocks), so they must not be
 * mistaken for turn boundaries: cutting between an assistant tool_use and
 * its tool_result would leave a conversation the provider rejects.
 */

function isToolResultMessage(m) {
  return Array.isArray(m.content) && m.content.some((b) => b?.type === "tool_result");
}

export function isTurnStart(m) {
  return m?.role === "user" && !isToolResultMessage(m);
}

function previewOf(m) {
  const text =
    typeof m.content === "string"
      ? m.content
      : (m.content || []).filter((b) => b?.type === "text").map((b) => b.text).join(" ");
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}...` : oneLine || "(no text)";
}

/** @returns {{number: number, index: number, preview: string}[]} turns, 1-based */
export function listTurns(messages) {
  const turns = [];
  messages.forEach((m, index) => {
    if (isTurnStart(m)) turns.push({ number: turns.length + 1, index, preview: previewOf(m) });
  });
  return turns;
}

/**
 * Keeps everything BEFORE turn `n` (1-based), dropping turn n and all later
 * ones. Throws a readable Error for out-of-range values or if nothing would
 * be left (that is a new session, not a rewind).
 */
export function rewindToTurn(messages, n) {
  const turns = listTurns(messages);
  if (turns.length === 0) throw new Error("This session has no user turns to rewind.");
  if (!Number.isInteger(n) || n < 1 || n > turns.length) {
    throw new Error(`Turn must be a whole number between 1 and ${turns.length}.`);
  }
  if (n === 1) {
    throw new Error("Rewinding to before turn 1 would leave an empty conversation; start a new session instead.");
  }
  return { messages: messages.slice(0, turns[n - 1].index), dropped: turns.length - n + 1, remaining: n - 1 };
}

/** Drops the last `k` turns (k >= 1). */
export function dropLastTurns(messages, k) {
  const total = listTurns(messages).length;
  if (!Number.isInteger(k) || k < 1) throw new Error("--turns must be a whole number of at least 1.");
  if (k >= total) {
    throw new Error(`This session has ${total} turn(s); dropping ${k} would leave nothing. Use --list to see them.`);
  }
  return rewindToTurn(messages, total - k + 1);
}
