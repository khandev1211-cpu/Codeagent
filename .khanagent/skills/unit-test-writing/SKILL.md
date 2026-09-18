---
name: unit-test-writing
description: Write focused unit tests for a function or module. Use when the user asks for tests, or after writing non-trivial new logic that has no test coverage yet.
allowed-tools: read_file, write_file, edit_file, search_code, run_bash
---

# Unit Test Writing

1. Find the project's actual test framework and conventions first (search for existing `*.test.*`/`*_test.*`/`test_*.py` files) — match the existing style rather than introducing a second testing convention.
2. Test behavior, not implementation — assert on what a function returns/does for given inputs, not on internal details that could change without the behavior changing.
3. Cover: the normal case, at least one edge case (empty input, zero, boundary value), and at least one error case if the function can fail.
4. One logical assertion focus per test — a test named `handles invalid input` that also silently checks three unrelated things makes failures hard to diagnose.
5. Don't test the language or the framework — a test asserting `2 + 2 === 4` isn't testing your code.
6. Run the test suite after writing (`run_bash`) — a test that was never actually run might have a typo that makes it vacuously pass or never execute.
7. Keep test data minimal and obviously-relevant — a 200-line fixture for a test that only needs 3 fields obscures what's actually being tested.
