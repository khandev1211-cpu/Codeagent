---
name: test-coverage-analysis
description: Assess whether test coverage is adequate for a change, and identify meaningful gaps. Use when asked to check test coverage, or before considering a feature complete.
allowed-tools: read_file, search_code, run_bash
---

# Test Coverage Analysis

1. Run the project's actual coverage tool if one is configured (`run_bash` — e.g. `npm run test:coverage`, `pytest --cov`, `go test -cover`) rather than eyeballing which files have a matching test file.
2. A high percentage number is not the goal — 100% line coverage with no assertions on edge cases is worse than 70% coverage that actually exercises the risky paths (error handling, boundary conditions, concurrent access).
3. Prioritize gaps by risk, not by file size: uncovered error-handling code and uncovered code on a critical path (auth, payments, data writes) matter more than an uncovered getter.
4. Don't write tests just to move a coverage number — if a gap is in truly trivial code (a one-line passthrough), it's fine to leave it, and say so explicitly rather than padding the suite.
5. Report findings concretely: which specific functions/branches lack coverage and why they matter, not just "coverage is at 62%."
