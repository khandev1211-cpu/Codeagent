import { describe, it, expect } from "vitest";
import { resolveSlashCommand, expandTemplate, formatHelp } from "../../src/agent/slashCommands.js";
import { SlashCommandRegistry } from "../../src/agent/slashCommands.js";

const registry = new SlashCommandRegistry({
  commands: [
    { name: "review", description: "Review a diff.", template: "Please review: $ARGUMENTS", path: "p1" },
    { name: "standup", description: "Daily standup summary.", template: "Summarize recent commits for standup.", path: "p2" },
  ],
});

describe("expandTemplate", () => {
  it("substitutes $ARGUMENTS in place when present", () => {
    expect(expandTemplate("Review this: $ARGUMENTS please", "file.js")).toBe("Review this: file.js please");
  });

  it("substitutes all occurrences of $ARGUMENTS, not just the first", () => {
    expect(expandTemplate("$ARGUMENTS and $ARGUMENTS again", "x")).toBe("x and x again");
  });

  it("appends args at the end when no $ARGUMENTS placeholder exists and args were given", () => {
    expect(expandTemplate("Fixed template.", "extra context")).toBe("Fixed template.\n\nextra context");
  });

  it("returns the template unchanged when there's no placeholder and no args given", () => {
    expect(expandTemplate("Fixed template.", "")).toBe("Fixed template.");
  });

  it("substitutes to an empty string when $ARGUMENTS is present but no args were given", () => {
    expect(expandTemplate("Review: $ARGUMENTS", "")).toBe("Review: ");
  });
});

describe("resolveSlashCommand", () => {
  it("returns type 'none' for ordinary (non-slash) input", () => {
    expect(resolveSlashCommand("please fix the bug", { commandRegistry: registry })).toEqual({ type: "none" });
  });

  it("recognizes /help", () => {
    expect(resolveSlashCommand("/help", { commandRegistry: registry })).toEqual({ type: "help" });
  });

  it("recognizes /clear", () => {
    expect(resolveSlashCommand("/clear", { commandRegistry: registry })).toEqual({ type: "clear" });
  });

  it("recognizes /plan", () => {
    expect(resolveSlashCommand("/plan", { commandRegistry: registry })).toEqual({ type: "plan-toggle" });
  });

  it("is case-insensitive for the command name", () => {
    expect(resolveSlashCommand("/HELP", { commandRegistry: registry })).toEqual({ type: "help" });
  });

  it("resolves a custom command with no arguments", () => {
    const result = resolveSlashCommand("/standup", { commandRegistry: registry });
    expect(result).toEqual({ type: "prompt", text: "Summarize recent commits for standup.", commandName: "standup" });
  });

  it("resolves a custom command with arguments, substituted into the template", () => {
    const result = resolveSlashCommand("/review file.js and check for bugs", { commandRegistry: registry });
    expect(result.type).toBe("prompt");
    expect(result.text).toBe("Please review: file.js and check for bugs");
  });

  it("returns type 'unknown' for an unrecognized command name, with the list of what IS available", () => {
    const result = resolveSlashCommand("/nonexistent", { commandRegistry: registry });
    expect(result.type).toBe("unknown");
    expect(result.name).toBe("nonexistent");
    expect(result.available).toEqual(["review", "standup"]);
  });

  it("built-in names always win over a same-named custom command", () => {
    const shadowedRegistry = new SlashCommandRegistry({
      commands: [{ name: "help", description: "A project's own /help.", template: "Custom help text.", path: "p" }],
    });
    expect(resolveSlashCommand("/help", { commandRegistry: shadowedRegistry })).toEqual({ type: "help" });
  });

  it("works with no commandRegistry provided at all (built-ins still resolve)", () => {
    expect(resolveSlashCommand("/clear", {})).toEqual({ type: "clear" });
  });
});

describe("formatHelp", () => {
  it("always lists the three built-ins", () => {
    const help = formatHelp(registry);
    expect(help).toContain("/help");
    expect(help).toContain("/clear");
    expect(help).toContain("/plan");
  });

  it("lists custom commands with their descriptions when present", () => {
    const help = formatHelp(registry);
    expect(help).toContain("/review");
    expect(help).toContain("Review a diff.");
    expect(help).toContain("/standup");
  });

  it("doesn't crash and omits the custom section when there are no custom commands", () => {
    const empty = new SlashCommandRegistry({ commands: [] });
    const help = formatHelp(empty);
    expect(help).toContain("/help");
    expect(help).not.toContain("Custom commands");
  });

  it("doesn't crash when commandRegistry is undefined", () => {
    expect(() => formatHelp(undefined)).not.toThrow();
  });
});
