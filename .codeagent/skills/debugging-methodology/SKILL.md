---
name: debugging-methodology
description: Systematically debug an issue rather than guessing at fixes. Use when investigating a bug whose cause isn't immediately obvious.
allowed-tools: read_file, search_code, run_bash
---

# Debugging Methodology

1. Reproduce it first — a fix for a bug you can't reliably reproduce is a guess, not a fix. Find the minimal, reliable steps to trigger it before touching any code.
2. Form a specific hypothesis about the cause, then test that hypothesis directly (a targeted log, a breakpoint, a small script) — don't make speculative changes and see if the symptom happens to go away, which risks fixing a coincidence instead of the actual cause.
3. Bisect the problem space — narrow down which layer (frontend/backend/database), which recent change, or which input actually matters, rather than examining the whole system at once.
4. Read the actual error/stack trace fully before theorizing — the real cause is often stated plainly in text that got skimmed past.
5. Once you find *a* plausible cause, verify it's *the* cause (temporarily force the condition and confirm the bug reproduces, or remove it and confirm the bug disappears) before writing the fix.
6. After fixing, add a regression test that would have caught this bug, and confirm it actually fails against the old (buggy) code path conceptually — a fix with no test protecting it can regress silently later.
