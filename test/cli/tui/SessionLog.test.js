import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { SessionLog } from "../../../src/cli/tui/SessionLog.js";
import { h } from "../../../src/cli/tui/h.js";

describe("SessionLog", () => {
  it("renders a user message", () => {
    const { lastFrame } = render(h(SessionLog, { entries: [{ type: "user_message", text: "add a login form" }] }));
    expect(lastFrame()).toContain("add a login form");
  });

  it("renders assistant text", () => {
    const { lastFrame } = render(h(SessionLog, { entries: [{ type: "assistant_text", text: "Done." }] }));
    expect(lastFrame()).toContain("Done.");
  });

  it("renders a plain tool call with no status", () => {
    const { lastFrame } = render(h(SessionLog, { entries: [{ type: "tool_call", tool: "read_file", detail: "auth.js" }] }));
    const frame = lastFrame();
    expect(frame).toContain("read_file");
    expect(frame).toContain("auth.js");
  });

  it("renders a confirmed/allowed tool call distinctly", () => {
    const { lastFrame } = render(
      h(SessionLog, { entries: [{ type: "tool_call", tool: "write_file", status: "allowed", detail: "npm test*" }] })
    );
    expect(lastFrame()).toContain("allowed by rule");
  });

  it("renders a denied tool call with the rule reason", () => {
    const { lastFrame } = render(
      h(SessionLog, { entries: [{ type: "tool_call", tool: "write_file", status: "denied", detail: "rule: *.env" }] })
    );
    const frame = lastFrame();
    expect(frame).toContain("denied by rule");
    expect(frame).toContain("*.env");
  });

  it("renders a planned (Plan Mode) tool call distinctly from denied/declined", () => {
    const { lastFrame } = render(
      h(SessionLog, { entries: [{ type: "tool_call", tool: "write_file", status: "planned", detail: "would write x.js" }] })
    );
    expect(lastFrame()).toContain("planned, not executed");
  });

  it("renders multiple entries in order", () => {
    const { lastFrame } = render(
      h(SessionLog, {
        entries: [
          { type: "user_message", text: "first" },
          { type: "tool_call", tool: "read_file", detail: "a.js" },
          { type: "assistant_text", text: "second" },
        ],
      })
    );
    const frame = lastFrame();
    const firstIdx = frame.indexOf("first");
    const toolIdx = frame.indexOf("read_file");
    const secondIdx = frame.indexOf("second");
    expect(firstIdx).toBeLessThan(toolIdx);
    expect(toolIdx).toBeLessThan(secondIdx);
  });

  it("renders nothing but doesn't throw for an empty entries array", () => {
    expect(() => render(h(SessionLog, { entries: [] }))).not.toThrow();
  });
});
