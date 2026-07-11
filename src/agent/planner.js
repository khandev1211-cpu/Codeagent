/**
 * Thin wrapper around the same provider call the main loop uses — not a
 * separate execution engine. Invoked only when planning is explicitly
 * requested or enabled by config for complex turns (doc 04).
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
  if (/plan this out|make a plan|plan first/i.test(userRequest)) return true;
  return Boolean(config.planningEnabled);
}
