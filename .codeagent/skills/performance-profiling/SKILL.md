---
name: performance-profiling
description: Diagnose a performance problem systematically using profiling rather than guessing. Use when asked to investigate why something is slow.
allowed-tools: read_file, run_bash, search_code
---

# Performance Profiling

1. Measure before changing anything — get a baseline number for the actual slow operation, using the language/runtime's real profiler (`run_bash`) rather than guessing which part is slow from reading the code.
2. Find the actual hot path — profilers routinely reveal that the slow part isn't where intuition suggested; don't optimize based on assumption.
3. Optimize the biggest win first — a function called once taking 500ms usually matters less than a function called 10,000 times taking 1ms each (10 seconds total), even though the second looks "fast" in isolation.
4. After each change, re-measure the same way you measured the baseline — confirm the change actually helped, by how much, and that nothing else regressed.
5. Know when to stop — once the operation is fast enough for its actual real-world requirement, further optimization has diminishing returns and real costs (code complexity, maintenance burden).
6. Distinguish algorithmic complexity problems (O(n²) that needs a different approach) from constant-factor problems (this specific loop could be a bit faster) — they need different fixes, and the first is usually the bigger win if present.
