import { describe, it, expect } from "vitest";
import { PassThrough } from "node:stream";
import { createConfirmer } from "../../src/safety/confirm.js";
import { isDestructive } from "../../src/safety/policy.js";

const nonDestructiveTool = { name: "read_file", destructive: false };
const destructiveTool = { name: "write_file", destructive: true };

describe("policy.isDestructive", () => {
  it("reads the tool's own flag rather than guessing from input", () => {
    expect(isDestructive(nonDestructiveTool)).toBe(false);
    expect(isDestructive(destructiveTool)).toBe(true);
  });
});

describe("confirm gate", () => {
  it("allows non-destructive tools without any prompt", async () => {
    const confirm = createConfirmer({ config: { yolo: false } });
    const decision = await confirm(nonDestructiveTool, {});
    expect(decision.allowed).toBe(true);
  });

  it("bypasses confirmation under --yolo and logs it", async () => {
    const logged = [];
    const logger = { info: (msg, meta) => logged.push({ msg, meta }) };
    const confirm = createConfirmer({ config: { yolo: true }, logger });
    const decision = await confirm(destructiveTool, { path: "x" });
    expect(decision.allowed).toBe(true);
    expect(decision.bypassed).toBe(true);
    expect(logged.length).toBe(1);
  });

  it("declines destructive calls when there's no TTY and no --yolo", async () => {
    const fakeInput = new PassThrough();
    fakeInput.isTTY = false;
    const confirm = createConfirmer({ config: { yolo: false }, input: fakeInput });
    const decision = await confirm(destructiveTool, { path: "x" });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("no-tty");
  });
});
