# 04 — Agent Core & Loop

## The loop, precisely

`src/agent/orchestrator.js` implements this cycle for every user turn:

1. **Compose messages.** Take the current session's message history (via Context Manager, doc 08) and append the new user input.
2. **Call the provider.** Send messages + the Tool Registry's schema list (doc 05) to the Provider Layer (doc 06).
3. **Branch on response type:**
   - Plain text only → this is the final answer for the turn. Render it, persist the session, stop.
   - One or more `tool_use` blocks → go to step 4.
4. **Execute each tool call**, in order:
   a. Look up the tool definition in the Registry by name.
   b. Pass the call through the Safety Layer (doc 07) for classification/confirmation.
   c. If approved, run the tool's `execute()`; if declined, synthesize a `tool_result` indicating the user declined.
   d. Append the `tool_result` to the message history.
5. **Loop back to step 2** with the updated history (now including the tool results).
6. **Check limits before each iteration** (see below). If exceeded, stop the loop, surface a clear message to the user, and persist state so they can resume or raise the limit explicitly.

## Hard limits (non-negotiable defaults)

An agentic loop with no ceiling is the single most common failure mode for tools like this — it either burns API spend on a stuck loop or takes destructive actions in a runaway sequence. Two independent caps, enforced inside the orchestrator itself (not just recommended in docs):

| Limit | Default | Configurable? | Where enforced |
|---|---|---|---|
| Max iterations per turn | 25 | Yes, via config (doc 09) | orchestrator.js, checked before step 2 each cycle |
| Max token/cost budget per session | Set per user's own threshold | Yes | orchestrator.js, tracked cumulatively via Provider Layer's token counts |

When either limit is hit, the orchestrator does **not** silently truncate and keep going — it stops, tells the user exactly which limit was hit and the current count, and leaves the session resumable. Silent truncation would hide a legitimate signal that something is wrong (the model looping, a task genuinely larger than expected, etc.).

## Planner (optional layer)

`src/agent/planner.js` is separated from the orchestrator because not every task needs explicit decomposition — for simple requests, the tool-use loop itself is sufficient planning. The planner is invoked only when:
- The user explicitly asks for a plan first (e.g. "plan this out before making changes"), or
- A config flag enables planning-by-default for all turns above a certain estimated complexity.

When active, the planner asks the model for a structured task list *before* the main loop begins, and that list is injected into the system prompt for the subsequent tool-use turns so the model has explicit sub-goals to work through. This is intentionally a thin wrapper around the same loop, not a separate execution engine — it does not fork logic that needs to be maintained twice.

## System prompt composition

`src/agent/systemPrompt.js` builds the system prompt from:
1. A static base template (agent identity, tool-use conventions, safety expectations).
2. Injected project context — the lightweight file tree + package.json/README summary built at session start (doc 08 covers exactly how this is gathered and bounded in size).
3. Any active planner output (see above), if planning is in use for this turn.
4. User/config-level custom instructions, if the user has set any (doc 09).

These are concatenated in a fixed order so the prompt is deterministic and debuggable — given the same project + config, the base prompt should always resolve the same way modulo the parts that are genuinely dynamic (project tree, planner output).

## Error handling within the loop

- **Tool execution throws** → caught at the loop level, converted into a `tool_result` describing the error (not swallowed, not crashed out of the whole session). The model sees the failure and can decide how to proceed (retry differently, ask the user, give up gracefully).
- **Provider call fails** (network error, rate limit, malformed response) → retried with backoff a small, fixed number of times; if still failing, the turn ends with a clear error surfaced to the user rather than the loop looping forever.
- **User interrupts (Ctrl+C) mid-loop** → the in-flight tool call is allowed to finish if it's already started (to avoid leaving a file half-written), then the loop exits cleanly and persists whatever state exists so far.
