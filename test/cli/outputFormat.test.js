import { describe, it, expect } from "vitest";
import { createJsonOutput, isJsonFormat, OUTPUT_FORMATS } from "../../src/cli/outputFormat.js";

function collect(format) {
  const lines = [];
  const out = createJsonOutput({ format, write: (s) => lines.push(s) });
  return { out, parsed: () => lines.map((l) => JSON.parse(l)), raw: lines };
}

describe("outputFormat", () => {
  it("knows the three formats and which are JSON", () => {
    expect(OUTPUT_FORMATS).toEqual(["text", "json", "stream-json"]);
    expect(isJsonFormat("text")).toBe(false);
    expect(isJsonFormat("json")).toBe(true);
    expect(isJsonFormat("stream-json")).toBe(true);
  });

  it("json: prints nothing until finish, then exactly one result object", () => {
    const { out, parsed, raw } = collect("json");
    out.onEvent({ type: "tool_call", tool: "read_file", input: { path: "a" } });
    out.onEvent({ type: "final_text", text: "done" });
    expect(raw).toHaveLength(0);
    out.finish({ ok: true, exitCode: 0, sessionId: "s1", usage: { inputTokens: 3, outputTokens: 4 } });
    expect(parsed()).toEqual([
      { type: "result", ok: true, exit_code: 0, result: "done", session_id: "s1", usage: { input_tokens: 3, output_tokens: 4 } },
    ]);
  });

  it("stream-json: one line per event, then the result line; each line is valid JSON", () => {
    const { out, parsed, raw } = collect("stream-json");
    out.onEvent({ type: "tool_call", tool: "git_status", input: {} });
    out.onEvent({ type: "tool_result", tool: "git_status", result: { ok: true, files: "SECRET FILE CONTENT" } });
    out.onEvent({ type: "final_text", text: "hi" });
    out.finish({ ok: true, exitCode: 0, sessionId: "s", usage: null });
    expect(raw.every((l) => l.endsWith("\n") && !l.slice(0, -1).includes("\n"))).toBe(true);
    const types = parsed().map((e) => e.type);
    expect(types).toEqual(["tool_call", "tool_result", "assistant", "result"]);
    // tool output content is never streamed, only ok/error
    expect(raw.join("")).not.toContain("SECRET FILE CONTENT");
  });

  it("failure result carries the error and exit code", () => {
    const { out, parsed } = collect("json");
    out.finish({ ok: false, exitCode: 2, error: new Error("limit hit") });
    expect(parsed()[0]).toMatchObject({ ok: false, exit_code: 2, error: "limit hit", result: "", session_id: null, usage: null });
  });

  it("ignores unknown event types instead of emitting junk", () => {
    const { out, raw } = collect("stream-json");
    out.onEvent({ type: "something_new" });
    expect(raw).toHaveLength(0);
  });
});
