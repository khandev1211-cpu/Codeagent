import { describe, it, expect } from "vitest";
import { shouldPlan, buildRecitationMessage, RECITATION_INTERVAL } from "../../src/agent/planner.js";

describe("shouldPlan — Autonomous Mode makes planning unconditional", () => {
  it("returns true whenever config.autonomousMode is set, regardless of the request text", () => {
    expect(shouldPlan({ config: { autonomousMode: true }, userRequest: "just fix the typo" })).toBe(true);
  });

  it("still returns true for the phrase-matching trigger without autonomousMode", () => {
    expect(shouldPlan({ config: {}, userRequest: "please make a plan for this" })).toBe(true);
  });

  it("still returns true for config.planningEnabled without autonomousMode", () => {
    expect(shouldPlan({ config: { planningEnabled: true }, userRequest: "fix it" })).toBe(true);
  });

  it("returns false when none of the triggers apply", () => {
    expect(shouldPlan({ config: {}, userRequest: "fix the typo" })).toBe(false);
  });
});

describe("buildRecitationMessage", () => {
  it("returns a user-role message, not a system-prompt edit", () => {
    const message = buildRecitationMessage("1. Do X\n2. Do Y");
    expect(message.role).toBe("user");
  });

  it("includes the original plan text verbatim", () => {
    const plan = "1. Read the config\n2. Write the fix\n3. Run tests";
    const message = buildRecitationMessage(plan);
    expect(message.content).toContain(plan);
  });

  it("clearly marks the message as a reminder, not new user instructions", () => {
    const message = buildRecitationMessage("1. Step one");
    expect(message.content.toLowerCase()).toContain("reminder");
    expect(message.content.toLowerCase()).toContain("not new instructions");
  });
});

describe("RECITATION_INTERVAL", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(RECITATION_INTERVAL)).toBe(true);
    expect(RECITATION_INTERVAL).toBeGreaterThan(0);
  });
});
