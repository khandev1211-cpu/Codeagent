---
name: integration-test-writing
description: Write tests that exercise how multiple components work together (e.g. a service plus a real or realistic database). Use when unit tests alone wouldn't catch a real integration bug.
allowed-tools: read_file, write_file, edit_file, search_code, run_bash
---

# Integration Test Writing

1. Decide what's real and what's faked deliberately — a database might be a real instance (test container/in-memory), while a third-party payment API almost never should be. Don't fake something just because it's easier; fake it because calling the real thing is impractical or unsafe.
2. Set up and tear down state explicitly per test (or per suite, if the project's convention is a shared fixture) — tests that depend on execution order or leftover state from a previous test are a common source of flaky suites.
3. Test the actual integration points — a request hits a real route, goes through real middleware, touches a real (test) database — not a reimplementation of that flow with mocks standing in for the parts being integrated.
4. Keep integration tests separate from unit tests (different directory or naming convention) so the fast unit suite can run independently from the slower integration one.
5. Assert on observable outcomes (the HTTP response, the row that got written) rather than internal call counts, which is more of a unit-test-style assertion.
