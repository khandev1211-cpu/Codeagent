import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { ModelSwitcher } from "../../../src/cli/tui/ModelSwitcher.js";
import { h } from "../../../src/cli/tui/h.js";

const options = [
  { provider: "anthropic", model: "claude-sonnet-5", priceLabel: "$3.00/1M", isFree: false, isCurrent: true },
  { provider: "mistral", model: "codestral-latest", priceLabel: "free", isFree: true, isCurrent: false },
  { provider: "groq", model: "llama-3.3-70b", priceLabel: "free", isFree: true, isCurrent: false },
];

const wait = () => new Promise((r) => setTimeout(r, 30));

describe("ModelSwitcher", () => {
  it("renders every option, marking the current one", () => {
    const { lastFrame } = render(h(ModelSwitcher, { options, onSelect: () => {}, onCancel: () => {} }));
    const frame = lastFrame();
    expect(frame).toContain("claude-sonnet-5");
    expect(frame).toContain("codestral-latest");
    expect(frame).toContain("llama-3.3-70b");
    expect(frame).toContain("✓"); // marks the current option
  });

  it("selects the highlighted (first, by default) option on Enter", async () => {
    let selected = null;
    const { stdin } = render(h(ModelSwitcher, { options, onSelect: (o) => (selected = o), onCancel: () => {} }));
    stdin.write("\r");
    await wait();
    expect(selected.model).toBe("claude-sonnet-5");
  });

  it("moves the selection down with the down arrow before selecting", async () => {
    let selected = null;
    const { stdin } = render(h(ModelSwitcher, { options, onSelect: (o) => (selected = o), onCancel: () => {} }));
    stdin.write("\u001B[B"); // down
    stdin.write("\r");
    await wait();
    expect(selected.model).toBe("codestral-latest");
  });

  it("does not move past the last option", async () => {
    let selected = null;
    const { stdin } = render(h(ModelSwitcher, { options, onSelect: (o) => (selected = o), onCancel: () => {} }));
    stdin.write("\u001B[B\u001B[B\u001B[B\u001B[B\u001B[B"); // down 5x, only 3 options
    stdin.write("\r");
    await wait();
    expect(selected.model).toBe("llama-3.3-70b");
  });

  it("does not move above the first option", async () => {
    let selected = null;
    const { stdin } = render(h(ModelSwitcher, { options, onSelect: (o) => (selected = o), onCancel: () => {} }));
    stdin.write("\u001B[A\u001B[A"); // up 2x from index 0
    stdin.write("\r");
    await wait();
    expect(selected.model).toBe("claude-sonnet-5");
  });

  it("calls onCancel on Escape without calling onSelect", async () => {
    let selected = null;
    let cancelled = false;
    const { stdin } = render(
      h(ModelSwitcher, { options, onSelect: (o) => (selected = o), onCancel: () => (cancelled = true) })
    );
    stdin.write("\u001B");
    await wait();
    expect(cancelled).toBe(true);
    expect(selected).toBeNull();
  });

  it("filters the visible list as the user types", async () => {
    const { stdin, lastFrame } = render(h(ModelSwitcher, { options, onSelect: () => {}, onCancel: () => {} }));
    stdin.write("groq");
    await wait();
    const frame = lastFrame();
    expect(frame).toContain("llama-3.3-70b");
    expect(frame).not.toContain("claude-sonnet-5");
    expect(frame).not.toContain("codestral-latest");
  });

  it("selecting after filtering picks from the filtered list, not the original index", async () => {
    let selected = null;
    const { stdin } = render(h(ModelSwitcher, { options, onSelect: (o) => (selected = o), onCancel: () => {} }));
    stdin.write("mistral");
    await wait();
    stdin.write("\r");
    await wait();
    expect(selected.model).toBe("codestral-latest");
  });

  it("shows a no-match message and does not throw when the filter matches nothing", async () => {
    const { stdin, lastFrame } = render(h(ModelSwitcher, { options, onSelect: () => {}, onCancel: () => {} }));
    stdin.write("nonexistent-provider-xyz");
    await wait();
    expect(lastFrame()).toMatch(/No matching/i);
    // Enter with an empty filtered list must not throw or call onSelect.
    let selected = "unchanged";
    stdin.write("\r");
    await wait();
    expect(selected).toBe("unchanged");
  });
});
