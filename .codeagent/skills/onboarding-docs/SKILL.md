---
name: onboarding-docs
description: Write documentation to help a new contributor get a project running locally and make their first change. Use when creating onboarding/contributing documentation.
allowed-tools: read_file, write_file, run_bash
---

# Onboarding Docs

1. Verify every setup step actually works by checking it against the real project (`run_bash`) rather than writing plausible-sounding instructions — a broken first step loses a new contributor immediately.
2. List actual prerequisites with version requirements (a specific Node/Python/language version, required system tools) rather than assuming they're obvious.
3. Get to "the app runs locally" as fast as possible — defer explaining architecture or deep conventions until after that first success.
4. Include how to run the test suite and confirm it passes on a clean checkout — this doubles as environment verification for the new contributor.
5. Point to where the actual code lives for a common first task (e.g. "routes are in `src/routes/`, add a new one by...") to shorten the path to a first real contribution.
6. Keep environment-specific gotchas (a common error on macOS vs. Linux, a known issue with a specific Node version) documented explicitly rather than only known informally by the existing team.
