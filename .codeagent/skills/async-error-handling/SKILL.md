---
name: async-error-handling
description: Correctly handle errors in asynchronous code (promises, async/await, callbacks, futures). Use when writing or reviewing async code's error paths.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Async Error Handling

- An unhandled rejected promise/failed async task is a silent failure in most languages — every async operation needs an explicit error path (`try/catch` around `await`, `.catch()`, or the equivalent), not an assumption that errors will surface somewhere.
- For concurrent operations run together (`Promise.all` or equivalent), understand the actual failure semantics — one rejection typically fails the whole group immediately; if partial success should be tolerated, use the "settled" variant that collects per-operation results instead.
- Don't swallow an async error silently (an empty `catch` block) — at minimum log it, or explicitly document why it's safe to ignore.
- Async errors inside a callback aren't caught by a `try/catch` wrapping the function that registered the callback, in languages/runtimes without automatic propagation — this is a common, subtle correctness bug; confirm the actual propagation semantics for the specific async pattern being used.
- Timeouts: async operations waiting on external resources (network calls) should have an explicit timeout rather than being able to hang indefinitely on a stalled dependency.
- Clean up resources (connections, listeners) in a `finally`-equivalent path so they're released whether the async operation succeeded or failed.
