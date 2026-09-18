---
name: reading-stack-traces
description: Correctly interpret a stack trace or error output to find the real cause. Use whenever debugging starts from an exception, crash, or error log.
allowed-tools: read_file, search_code
---

# Reading Stack Traces

1. Read the exception type and message first, fully — not just the first line truncated in a terminal; the specific wording often states exactly what went wrong.
2. Find where *your* code appears in the trace, not just the top frame — the top frame is often deep inside a library or the language runtime; the actionable line is usually the highest frame that's actually your application's code.
3. Distinguish the immediate error from its root cause — a "cannot read property of undefined" often has an earlier, different root cause (why was it undefined) that a single stack frame won't show; check what produced that undefined value.
4. For a chained/wrapped exception (a "caused by" section, an inner exception), the innermost cause is usually the real origin — the outer wrapping often just adds context, not a different problem.
5. Cross-reference the exact line number against the actual current file content (`read_file`) — a stack trace line number can be stale if the file has changed since the process started (especially in dev with hot-reload) or since the trace was captured.
6. Don't fix the symptom at the line the trace points to without understanding why the bad value/state reached that line in the first place — that often just moves the crash somewhere else.
