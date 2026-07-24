import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { InputBox } from "../../../src/cli/tui/InputBox.js";
import { h } from "../../../src/cli/tui/h.js";

describe("InputBox", () => {
  it("shows the placeholder when empty and enabled", () => {
    const { lastFrame } = render(h(InputBox, { value: "", onChange: () => {}, onSubmit: () => {}, disabled: false }));
    expect(lastFrame()).toContain("Tab to switch model");
  });

  it("shows the current value", () => {
    const { lastFrame } = render(
      h(InputBox, { value: "add validation", onChange: () => {}, onSubmit: () => {}, disabled: false })
    );
    expect(lastFrame()).toContain("add validation");
  });

  it("shows a working indicator and hides the text input while disabled", () => {
    const { lastFrame } = render(
      h(InputBox, { value: "should not show", onChange: () => {}, onSubmit: () => {}, disabled: true })
    );
    const frame = lastFrame();
    expect(frame).toContain("working");
    expect(frame).not.toContain("should not show");
  });
});
