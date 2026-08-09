import { describe, it, expect } from "vitest";
import { describePlannedAction } from "../../src/safety/planMode.js";

describe("describePlannedAction", () => {
  it("prefixes the summarized call with a clear 'not executed' marker", () => {
    const description = describePlannedAction("write_file", { path: "x.js", content: "hi" });
    expect(description).toMatch(/^\[plan mode — not executed\]/);
  });

  it("reuses summarizeCall's exact per-tool formatting, not a duplicate implementation", () => {
    const description = describePlannedAction("run_bash", { command: "rm -rf /" });
    expect(description).toContain("run_bash -> rm -rf /");
  });

  it("includes the target path for file-writing tools", () => {
    const description = describePlannedAction("write_file", { path: "src/index.js", content: "abc" });
    expect(description).toContain("src/index.js");
  });
});
