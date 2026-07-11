# 02 — System Architecture

## High-level diagram

```
┌─────────────────────────────────────────────────────────┐
│                        bin/cli.js                        │
│              (entrypoint, arg parsing, boot)              │
└───────────────────────┬───────────────────────────────────┘
                         │
                ┌────────▼─────────┐
                │   REPL / UI Layer │   (doc 10)
                └────────┬─────────┘
                         │
                ┌────────▼─────────┐
                │    Agent Core     │   (doc 04)
                │  orchestrator.js  │
                └───┬────────┬──────┘
                    │        │
        ┌───────────▼──┐  ┌──▼────────────┐
        │ Provider Layer│  │  Tool Registry │
        │   (doc 06)    │  │   (doc 05)     │
        └───────────────┘  └──┬─────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Individual Tools    │
                    │      (doc 05)         │
                    └──────────┬────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Safety/Confirmation  │
                    │   Layer (doc 07)      │
                    └───────────────────────┘

        ┌────────────────────────────────────┐
        │   Cross-cutting: Session Store,     │
        │   Config, Logger, Context Manager   │
        │        (doc 08, doc 09)             │
        └────────────────────────────────────┘
```

## Layer responsibilities (separation of concerns)

Each layer has exactly one job and talks to its neighbors through a narrow interface. This is the core discipline that keeps the system extensible (doc 11) without the orchestrator becoming a god-object.

| Layer | Owns | Does NOT own |
|---|---|---|
| CLI/REPL | Argument parsing, terminal I/O, output rendering | Any decision about what tool to call |
| Agent Core | The loop: send → tool_use → execute → tool_result → repeat | Tool implementation details, provider wire format |
| Provider Layer | Translating the loop's abstract "send messages, get response" into a specific API's request/response shape | Deciding when to call a tool — that's the model's job, mediated by the loop |
| Tool Registry | Holding the list of available tools and their schemas | Executing tool logic itself — that's each tool module's job |
| Individual Tools | Doing one file/shell operation each, returning a structured result | Safety decisions — a tool doesn't know if it's allowed to run, only how to run |
| Safety Layer | Classifying and gating destructive actions | Tool logic, provider logic |
| Session Store | Persisting conversation + file-change history to disk | Context window decisions (that's Context Manager, doc 08) |
| Config | Resolving layered settings into one final config object | Nothing else consumes raw config files directly — everything reads through this |

## Data flow for a single turn

1. User types a request in the REPL.
2. REPL hands the raw string to Agent Core, which appends it to the current session's message list (via Context Manager).
3. Agent Core calls Provider Layer with the full message list + the Tool Registry's exported schemas.
4. Provider Layer returns either final text, or one or more `tool_use` blocks.
5. For each `tool_use` block: Agent Core looks up the tool in the Registry, passes the call through the Safety Layer, then executes.
6. Tool result is appended as a `tool_result` message; loop returns to step 3.
7. When the model returns plain text with no tool calls, the loop ends for this turn, REPL renders the final text, and the session is persisted.

## Why this shape

- **Provider swap should be a one-file change.** Because Agent Core only talks to the Provider Layer's abstract interface (doc 06), adding a second LLM provider means writing one new adapter, not touching the loop.
- **Tool addition should be a one-file change.** Because tools self-describe their schema (doc 05) and the Registry auto-collects them, adding a tool never requires editing orchestrator.js.
- **Safety can't be silently skipped.** Because tool execution is *required* to route through the Safety Layer (not optional per-tool), there's no code path where a destructive action bypasses confirmation except the explicit, logged `--yolo` flag (doc 07).
- **Sessions survive crashes.** Because Session Store persists after every turn (not just on clean exit), a killed process loses at most one in-flight turn.

## Cross-cutting concerns

These aren't a layer in the request path — they're consumed by multiple layers:

- **Config** (doc 09): loaded once at boot, read by CLI, Agent Core, Provider Layer, and Safety Layer.
- **Logger**: structured logging, with a strict rule that request/response bodies containing API keys are never logged at any level (doc 15).
- **Context Manager** (doc 08): lives conceptually inside Agent Core but is documented separately because it has enough independent logic (truncation, summarization, project-tree injection) to warrant its own doc.
