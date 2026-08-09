---
name: concurrency-patterns
description: Write correct concurrent code (goroutines, threads, async tasks). Use when adding code that runs multiple operations concurrently or in parallel.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Concurrency Patterns

- Only reach for concurrency to solve a real problem (genuine parallelism need, or overlapping I/O wait) — concurrency adds real complexity and failure modes, so sequential code is the correct default unless there's a specific reason not to.
- Prefer message-passing/channels over shared mutable state where the language supports it well (Go channels, actor patterns) — shared mutable state accessed from multiple concurrent contexts is the source of most concurrency bugs.
- If shared mutable state is genuinely necessary, protect every access to it consistently (a mutex/lock) — a lock protecting some accesses but not others provides no actual safety.
- Bound concurrency explicitly (a worker pool, a semaphore) rather than spawning unbounded goroutines/threads/tasks for unbounded work — unbounded concurrency against a finite resource (database connections, memory, an external API's rate limit) is a common way to take a system down under load.
- Understand the actual execution model you're working in — cooperative async (JS event loop, Python asyncio) has different failure modes than true OS-level threading/parallelism, and code correct in one model can be wrong in the other.
- Make cancellation and cleanup explicit for long-running concurrent work — a goroutine/task with no way to be cancelled when its result is no longer needed is a resource leak waiting to happen.
