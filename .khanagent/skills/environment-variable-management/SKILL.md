---
name: environment-variable-management
description: Manage environment-specific configuration correctly. Use when adding a new config value or reviewing how environment variables are handled across environments.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Environment Variable Management

- Never commit real values for secrets — commit a `.env.example`/`.env.sample` with the variable names and placeholder/dummy values, keep the real `.env` gitignored.
- Fail loudly at startup if a required env var is missing, rather than proceeding with `undefined`/`null` and failing confusingly later, deep in unrelated code.
- Validate and parse env vars once, at startup, into a typed config object — not scattered `process.env.X` (or equivalent) reads throughout the codebase, which make it hard to know what configuration the app actually depends on.
- Distinguish required vs. optional-with-a-sensible-default explicitly, rather than letting every var silently default to `undefined`.
- Don't put environment-specific logic (`if (env === "production")`) scattered through business logic — prefer configuration values that vary by environment over conditional code paths that do.
- Document what each variable does, not just its name, especially for anything non-obvious (a numeric timeout, a feature flag).
