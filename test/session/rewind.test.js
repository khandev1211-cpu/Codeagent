import { describe, it, expect } from "vitest";
import { listTurns, rewindToTurn, dropLastTurns, isTurnStart } from "../../src/session/rewind.js";

const user = (text) => ({ role: "user", content: text });
const assistantText = (text) => ({ role: "assistant", content: [{ type: "text", text }] });
const assistantTool = (id) => ({ role: "assistant", content: [{ type: "tool_use", id, name: "read_file", input: {} }] });
const toolResult = (id) => ({ role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] });

// turn 1 (no tools), turn 2 (a tool round-trip), turn 3 (no tools)
const convo = () => [
  user("first question"),
  assistantText("first answer"),
  user("second question that is long ".repeat(10)),
  assistantTool("t1"),
  toolResult("t1"),
  assistantText("second answer"),
  user("third\nquestion"),
  assistantText("third answer"),
];

describe("rewind", () => {
  it("tool_result messages are not turn starts, even though their role is user", () => {
    expect(isTurnStart(toolResult("x"))).toBe(false);
    expect(isTurnStart(user("hi"))).toBe(true);
    expect(isTurnStart(assistantText("hi"))).toBe(false);
    expect(isTurnStart({ role: "user", content: [{ type: "text", text: "with image" }, { type: "image" }] })).toBe(true);
  });

  it("listTurns numbers only real turns and previews them on one line, truncated", () => {
    const turns = listTurns(convo());
    expect(turns.map((t) => t.number)).toEqual([1, 2, 3]);
    expect(turns.map((t) => t.index)).toEqual([0, 2, 6]);
    expect(turns[2].preview).toBe("third question");
    expect(turns[1].preview.length).toBeLessThanOrEqual(80);
    expect(turns[1].preview.endsWith("...")).toBe(true);
  });

  it("rewindToTurn keeps everything before the chosen turn and never splits a tool round-trip", () => {
    const r = rewindToTurn(convo(), 3);
    expect(r).toMatchObject({ dropped: 1, remaining: 2 });
    expect(r.messages).toHaveLength(6); // turns 1 and 2, including tool_use + tool_result
    expect(r.messages.at(-1).content[0].text).toBe("second answer");

    const r2 = rewindToTurn(convo(), 2);
    expect(r2.messages).toHaveLength(2);
    expect(r2).toMatchObject({ dropped: 2, remaining: 1 });
  });

  it("every rewind result starts with a user turn and ends on an assistant message", () => {
    for (const n of [2, 3]) {
      const { messages } = rewindToTurn(convo(), n);
      expect(isTurnStart(messages[0])).toBe(true);
      expect(messages.at(-1).role).toBe("assistant");
    }
  });

  it("does not mutate the input", () => {
    const original = convo();
    const snapshot = JSON.stringify(original);
    rewindToTurn(original, 2);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("rejects out-of-range, non-integer, and rewind-to-empty", () => {
    expect(() => rewindToTurn(convo(), 0)).toThrow(/between 1 and 3/);
    expect(() => rewindToTurn(convo(), 4)).toThrow(/between 1 and 3/);
    expect(() => rewindToTurn(convo(), 1.5)).toThrow(/whole number/);
    expect(() => rewindToTurn(convo(), Number.NaN)).toThrow(/whole number/);
    expect(() => rewindToTurn(convo(), 1)).toThrow(/empty conversation/);
    expect(() => rewindToTurn([], 1)).toThrow(/no user turns/);
  });

  it("dropLastTurns drops k turns from the end and refuses to drop everything", () => {
    expect(dropLastTurns(convo(), 1).messages).toHaveLength(6);
    expect(dropLastTurns(convo(), 2).messages).toHaveLength(2);
    expect(() => dropLastTurns(convo(), 3)).toThrow(/leave nothing/);
    expect(() => dropLastTurns(convo(), 0)).toThrow(/at least 1/);
    expect(() => dropLastTurns(convo(), -1)).toThrow(/at least 1/);
    expect(() => dropLastTurns(convo(), 1.2)).toThrow(/whole number/);
  });
});
