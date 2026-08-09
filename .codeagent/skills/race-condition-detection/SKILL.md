---
name: race-condition-detection
description: Identify and fix a race condition in concurrent code. Use when a bug only reproduces intermittently under concurrent/parallel execution, or when reviewing concurrent code for races.
allowed-tools: read_file, search_code, run_bash
---

# Race Condition Detection

1. A race condition's signature is intermittent, load-dependent failure that doesn't reproduce reliably in isolation — treat "it fails sometimes, especially under load, and I can't pin down why" as a strong signal to look for one specifically.
2. Look for shared mutable state accessed from more than one concurrent context without consistent synchronization — this is the pattern behind almost every race condition.
3. Use the language's race detector if one exists (Go's `-race` flag, ThreadSanitizer, `run_bash`) rather than only manual code review — these tools catch races that are genuinely hard to spot by reading code.
4. Check-then-act patterns are a classic race source (`if resource doesn't exist, create it` — two concurrent calls can both pass the check before either creates it) — these need an atomic operation or a lock spanning both the check and the act, not two separate steps.
5. A fix needs to make the actual race impossible, not just less likely — reducing the race window (adding a small delay) doesn't fix it, it just makes it rarer and harder to debug next time.
6. After fixing, if there's a way to stress-test the concurrent path (many parallel requests/calls hitting the same code), do it to gain real confidence beyond "the one manual test passed."
