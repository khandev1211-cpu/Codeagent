import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { StatusHeader } from "../../../src/cli/tui/StatusHeader.js";
import { h } from "../../../src/cli/tui/h.js";

describe("StatusHeader", () => {
  it("renders the model, provider, skills count, and rules count", () => {
    const { lastFrame } = render(
      h(StatusHeader, {
        model: "claude-sonnet-5",
        provider: "anthropic",
        planMode: false,
        skillsCount: 102,
        rulesCount: 4,
        cwd: "/home/user/project",
      })
    );
    const frame = lastFrame();
    expect(frame).toContain("claude-sonnet-5");
    expect(frame).toContain("anthropic");
    expect(frame).toContain("102 skills");
    expect(frame).toContain("4 rules active");
    expect(frame).toContain("/home/user/project");
  });

  it("shows plan mode as off by default", () => {
    const { lastFrame } = render(
      h(StatusHeader, { model: "m", provider: "p", planMode: false, skillsCount: 0, rulesCount: 0, cwd: "/x" })
    );
    expect(lastFrame()).toContain("plan mode: off");
  });

  it("shows plan mode as on when active", () => {
    const { lastFrame } = render(
      h(StatusHeader, { model: "m", provider: "p", planMode: true, skillsCount: 0, rulesCount: 0, cwd: "/x" })
    );
    expect(lastFrame()).toContain("plan mode: on");
  });

  it("advertises the real keybinding (Tab, not Ctrl+K)", () => {
    // Ctrl+K was the original design (see the visual mockup this was built
    // from), but ink-text-input doesn't special-case it and would append
    // the literal "k" to the input box on the same keystroke that opens
    // the switcher — reproduced with a real PTY, not hypothetical. Tab is
    // one of the keys ink-text-input unconditionally ignores, so it's what
    // actually ships. The header must say what actually works.
    const { lastFrame } = render(
      h(StatusHeader, { model: "m", provider: "p", planMode: false, skillsCount: 0, rulesCount: 0, cwd: "/x" })
    );
    expect(lastFrame()).toContain("Tab to switch");
    expect(lastFrame()).not.toContain("Ctrl+K");
    expect(lastFrame()).not.toContain("⌘K");
  });
});
