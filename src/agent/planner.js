/**
 * Thin wrapper around the same provider call the main loop uses — not a
 * separate execution engine. Invoked only when planning is explicitly
 * requested or enabled by config for complex turns (doc 04), or
 * unconditionally in Autonomous Mode (doc 31).
 */
export async function planTurn({ provider, userRequest, projectContextSummary }) {
  const result = await provider.send(
    [
      {
        role: "user",
        content: `Break the following coding task into a short, concrete task list (3-8 steps). Return only the list.\n\nProject context:\n${
          projectContextSummary || "(none)"
        }\n\nTask: ${userRequest}`,
      },
    ],
    [],
    { maxTokens: 500 }
  );
  const textBlock = result.content.find((b) => b.type === "text");
  return textBlock?.text || null;
}

export function shouldPlan({ config, userRequest }) {
  if (config.autonomousMode) return true;
  if (/plan this out|make a plan|plan first/i.test(userRequest)) return true;
  return Boolean(config.planningEnabled);
}

// How often (in orchestrator loop iterations) the plan gets recited back
// into context during Autonomous Mode — see buildRecitationMessage below
// and docs/31's "recitation" section for the full reasoning (countering
// lost-in-the-middle drift on long tool-use loops, a technique verified
// against Manus's own published engineering writeup, not guessed at).
export const RECITATION_INTERVAL = 5;

/**
 * A plain conversation message (not a system-prompt rewrite) restating
 * the plan — deliberately a `user`-role message appended to history,
 * not a system-prompt edit, so it works identically across every
 * provider adapter without any provider-specific cache-invalidation
 * handling (docs/31 explains the tradeoff explicitly).
 */
export function buildRecitationMessage(plan) {
  return {
    role: "user",
    content: `(Reminder — this is your own plan for this task, restated so you don't lose track on a long turn. Keep working through it; this is not new instructions from the user.)\n\n${plan}`,
  };
}
