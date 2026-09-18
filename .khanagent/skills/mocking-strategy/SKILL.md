---
name: mocking-strategy
description: Decide what to mock, fake, or stub in a test, and how. Use when writing tests that involve external dependencies (network calls, databases, the filesystem, time).
allowed-tools: read_file, write_file, edit_file, search_code
---

# Mocking Strategy

1. Mock at the boundary you own, not deep inside a library — mock your own HTTP client wrapper, not the internals of the HTTP library it's built on.
2. Prefer a real, fast, in-memory fake over a mock with recorded expectations when one is easy to build — a fake in-memory implementation of a repository interface is usually more robust than a mock asserting exact call arguments.
3. Never mock the thing you're actually trying to test — a test for "does this function correctly call the API" that mocks the function under test proves nothing.
4. Mock time explicitly (a clock/date injection point) rather than letting tests depend on `Date.now()`/`time.Now()` directly — otherwise tests become flaky near midnight or DST boundaries, or just impossible to write deterministically for date-sensitive logic.
5. Reset/restore mocks between tests — a mock left configured from a previous test silently leaking into the next one is a common, confusing source of flaky failures.
6. If a test needs many mocks to even set up, that's often a signal the code under test has too many responsibilities, not just that the test is hard to write.
