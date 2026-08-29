import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render } from "ink-testing-library";
import { VimInputBox } from "../../../src/cli/tui/VimInputBox.js";
import { h } from "../../../src/cli/tui/h.js";

const ESC = "\u001B";

/**
 * ink's stdin parser needs a real tick between writes to correctly
 * disambiguate a bare Escape from the start of an ANSI escape *sequence*
 * (arrow keys etc. also begin with \u001B) — writing keys back-to-back
 * synchronously in a test does not reliably reproduce how a real
 * terminal delivers keystrokes over time. Verified directly against
 * ink's `useInput`: a bare ESC followed immediately (no delay) by
 * another key can misparse, while the same two writes with ~20ms
 * between them correctly resolve to two separate key events.
 */
async function tick(ms = 20) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function press(instance, keys) {
  for (const key of keys) {
    instance.stdin.write(key);
    await tick();
  }
}

/**
 * VimInputBox is a controlled component for `value` (only `mode` and
 * cursor position are its own internal state) — a bare `render()` call
 * with a fixed `value` prop never updates that prop between keystrokes,
 * so a sequence like "move to start, then delete a character" would
 * silently operate against the *original* value on every step instead of
 * the previously-edited one. This harness holds `value` in real React
 * state and re-renders on every `onChange`, mirroring exactly how
 * App.js actually wires this component up.
 */
function Harness({ initialValue, onSubmit }) {
  const [value, setValue] = useState(initialValue);
  return h(VimInputBox, { value, onChange: setValue, onSubmit, disabled: false });
}

function renderHarness(initialValue, onSubmit = vi.fn()) {
  const instance = render(h(Harness, { initialValue, onSubmit }));
  return { instance, onSubmit };
}

function renderPlain({ value = "", onChange = vi.fn(), onSubmit = vi.fn(), disabled = false } = {}) {
  const instance = render(h(VimInputBox, { value, onChange, onSubmit, disabled }));
  return { instance, onChange, onSubmit };
}

describe("VimInputBox", () => {
  it("starts in insert mode", () => {
    const { instance } = renderPlain({ value: "" });
    expect(instance.lastFrame()).toContain("-- INSERT --");
  });

  it("insert mode: a typed character is inserted at the cursor via onChange", async () => {
    const { instance, onChange } = renderPlain({ value: "ab" });
    await press(instance, ["x"]);
    expect(onChange).toHaveBeenCalledWith("abx");
  });

  it("insert mode: Escape switches to normal mode", async () => {
    const { instance } = renderPlain({ value: "hello" });
    await press(instance, [ESC]);
    expect(instance.lastFrame()).toContain("-- NORMAL --");
  });

  it("normal mode: 'i' switches back to insert mode", async () => {
    const { instance } = renderPlain({ value: "hello" });
    await press(instance, [ESC, "i"]);
    expect(instance.lastFrame()).toContain("-- INSERT --");
  });

  it("normal mode: '0' then 'x' deletes the first character", async () => {
    const { instance } = renderHarness("hello");
    await press(instance, [ESC, "0", "x"]);
    expect(instance.lastFrame()).toContain("ello");
    expect(instance.lastFrame()).not.toContain("hello");
  });

  it("normal mode: 'dd' clears the whole line", async () => {
    const { instance } = renderHarness("delete me");
    await press(instance, [ESC, "d", "d"]);
    expect(instance.lastFrame()).toContain("Type a message");
  });

  it("normal mode: a single 'd' not followed by another 'd' does not clear the line", async () => {
    const { instance } = renderHarness("keep me");
    await press(instance, [ESC, "d", "x"]); // 'd' then something other than 'd'
    expect(instance.lastFrame()).toContain("keep me");
  });

  it("Enter submits the current value from insert mode", async () => {
    const { instance, onSubmit } = renderPlain({ value: "send this" });
    await press(instance, ["\r"]);
    expect(onSubmit).toHaveBeenCalledWith("send this");
  });

  it("Enter submits the current value from normal mode too", async () => {
    const { instance, onSubmit } = renderPlain({ value: "send this too" });
    await press(instance, [ESC, "\r"]);
    expect(onSubmit).toHaveBeenCalledWith("send this too");
  });

  it("shows a working indicator and no mode line while disabled", () => {
    const { instance } = renderPlain({ value: "ignored", disabled: true });
    const frame = instance.lastFrame();
    expect(frame).toContain("working");
    expect(frame).not.toContain("-- INSERT --");
    expect(frame).not.toContain("-- NORMAL --");
  });

  it("does not call onChange or onSubmit for any key while disabled", async () => {
    const { instance, onChange, onSubmit } = renderPlain({ value: "ignored", disabled: true });
    await press(instance, ["x", "\r"]);
    expect(onChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows an empty-state placeholder when value is empty", () => {
    const { instance } = renderPlain({ value: "" });
    expect(instance.lastFrame()).toContain("Type a message");
  });
});
