---
name: memory-leak-detection
description: Diagnose a memory leak or unbounded memory growth. Use when a process's memory usage grows over time without bound, or asked to investigate a leak.
allowed-tools: read_file, run_bash, search_code
---

# Memory Leak Detection

1. Confirm it's actually a leak (unbounded growth) and not just a high but stable working set, or normal GC behavior — get a memory usage graph over time before assuming.
2. Use the runtime's actual heap profiling/snapshot tooling (`run_bash`) to find what's actually accumulating, rather than guessing from reading the code.
3. Common causes to check: event listeners registered but never removed, growing caches/maps with no eviction policy, closures unintentionally retaining large objects, timers/intervals never cleared, subscriptions never unsubscribed on cleanup.
4. In long-lived processes (servers), check for per-request or per-connection state that's created but never cleaned up when the request/connection ends.
5. Compare two heap snapshots taken some time apart under similar load to see what object counts/types are actually growing, rather than analyzing a single snapshot in isolation.
6. After a fix, confirm memory growth actually stops/stabilizes over a realistic duration, not just "the specific object I found is now cleaned up."
