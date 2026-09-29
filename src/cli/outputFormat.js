/**
 * Structured output for one-shot runs (`khanagent --output-format json "<request>"`).
 *
 *   text         (default) human-readable, unchanged behaviour
 *   json         nothing on stdout until the end, then ONE JSON object
 *   stream-json  one JSON object per line (NDJSON): events as they happen,
 *                followed by the same final {"type":"result"} line
 *
 * In both JSON modes stdout carries only JSON. Logs and diagnostics go to
 * stderr (see jsonLoggerSink), so `khanagent ... | jq` always works.
 * Tool results are reported as ok/error only, never their content: it can be
 * huge and may contain file contents the caller never asked to see.
 */
export const OUTPUT_FORMATS = ["text", "json", "stream-json"];

export function isJsonFormat(format) {
  return format === "json" || format === "stream-json";
}

/** Console-like sink that sends every log level to stderr (console.info/debug go to stdout). */
export const jsonLoggerSink = {
  debug: (...a) => console.error(...a),
  info: (...a) => console.error(...a),
  warn: (...a) => console.error(...a),
  error: (...a) => console.error(...a),
  log: (...a) => console.error(...a),
};

function errorMessage(err) {
  return typeof err === "string" ? err : err?.message || String(err);
}

function toStreamEvent(event) {
  switch (event.type) {
    case "tool_call":
      return { type: "tool_call", tool: event.tool, input: event.input };
    case "tool_result":
      return { type: "tool_result", tool: event.tool, ok: event.result?.ok !== false, ...(event.result?.error ? { error: String(event.result.error) } : {}) };
    case "tool_declined":
      return { type: "tool_declined", tool: event.tool, reason: event.reason };
    case "tool_blocked":
      return { type: "tool_blocked", tool: event.tool, reason: event.reason };
    case "tool_denied":
      return { type: "tool_denied", tool: event.tool, rule: event.rule?.pattern };
    case "tool_planned":
      return { type: "tool_planned", tool: event.tool, description: event.description };
    case "tool_error":
      return { type: "tool_error", tool: event.tool, error: errorMessage(event.error) };
    case "provider_error":
      return { type: "provider_error", error: errorMessage(event.error) };
    case "final_text":
      return { type: "assistant", text: event.text };
    default:
      return null;
  }
}

/**
 * @param {{format: string, write?: (s: string) => void}} opts
 * @returns {{onEvent: (e: object) => void, finish: (r: object) => void}}
 */
export function createJsonOutput({ format, write = (s) => process.stdout.write(s) }) {
  const state = { finalText: "", declined: false };
  const line = (obj) => write(`${JSON.stringify(obj)}\n`);

  return {
    onEvent(event) {
      if (event.type === "final_text") state.finalText = event.text;
      if (event.type === "tool_declined") state.declined = true;
      if (format !== "stream-json") return;
      const out = toStreamEvent(event);
      if (out) line(out);
    },
    /** Always emits exactly one result line, success or failure. */
    finish({ ok, exitCode, sessionId, usage, error }) {
      line({
        type: "result",
        ok,
        exit_code: exitCode,
        result: state.finalText,
        session_id: sessionId ?? null,
        usage: usage ? { input_tokens: usage.inputTokens ?? 0, output_tokens: usage.outputTokens ?? 0 } : null,
        ...(error ? { error: errorMessage(error) } : {}),
      });
    },
    get declined() {
      return state.declined;
    },
  };
}
