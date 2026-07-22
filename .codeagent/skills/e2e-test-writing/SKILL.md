---
name: e2e-test-writing
description: Write end-to-end tests that exercise a real user flow through the whole system. Use when the user asks for e2e/browser/UI tests, or when a bug only reproduces through the full stack.
allowed-tools: read_file, write_file, edit_file, search_code, run_bash
---

# End-to-End Test Writing

1. Test a real user journey, not an implementation detail — "user signs up, verifies email, logs in" is an e2e test; "the signup form's onChange handler fires" is not.
2. Use accessible selectors (role, label, visible text) over brittle CSS selectors or auto-generated class names — the test should survive a styling refactor.
3. Wait for real conditions (an element to appear, a network request to resolve) rather than a fixed `sleep()` — arbitrary delays are the single biggest cause of flaky e2e suites.
4. Keep the number of full e2e tests small and high-value — they're slow and expensive to maintain; push edge-case coverage down to unit/integration tests where it belongs.
5. Each e2e test should be able to run independently, starting from a known state (a fresh test user/account), not depend on a previous test having run first.
6. If the project already has an e2e framework configured (Playwright, Cypress, Selenium), use its existing conventions and page-object patterns rather than writing raw selectors inline.
