/**
 * Tier 2 of the two-tier skills index (docs/19). The system prompt's
 * skills section may contain only names (skillsIndexMode: "compact") —
 * this tool is how the model fetches the description + path for specific
 * names it suspects are relevant, instead of every skill's full
 * description being paid for on every turn regardless of relevance.
 *
 * Deliberately not wired up when skillsIndexMode is "full": in that mode
 * the index already carries descriptions inline, so this tool would be
 * redundant surface area rather than a saving (see registry.js wiring in
 * cli/index.js, cli/repl.js, cli/tui/index.js).
 */
export const skillInfo = {
  name: "skill_info",
  description:
    "Look up the description and file path for one or more skills by name, when the compact skills index (names only) doesn't tell you enough to decide relevance. Returns 'found: false' for unknown names rather than erroring.",
  input_schema: {
    type: "object",
    properties: {
      names: {
        type: "array",
        items: { type: "string" },
        description: "Skill names to look up, exactly as they appear in the skills index.",
      },
    },
    required: ["names"],
  },
  destructive: false,
  async execute(input, ctx) {
    if (!ctx.skillRegistry) {
      return { ok: false, error: "No skills are configured for this project." };
    }
    if (!Array.isArray(input.names) || input.names.length === 0) {
      return { ok: false, error: "names must be a non-empty array of skill names." };
    }
    return { ok: true, skills: ctx.skillRegistry.describe(input.names) };
  },
};
