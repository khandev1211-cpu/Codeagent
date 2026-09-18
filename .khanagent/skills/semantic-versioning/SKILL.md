---
name: semantic-versioning
description: Decide the correct semantic version bump (major/minor/patch) for a set of changes, and update version numbers accordingly. Use when asked to version or release a package.
allowed-tools: read_file, edit_file, run_bash
---

# Semantic Versioning

- **Major** (`X.0.0`): a breaking change — anything that could break existing correct usage of the public API (removed/renamed exports, changed function signatures, changed default behavior a caller could reasonably have depended on).
- **Minor** (`0.X.0`): a backward-compatible addition — new exported functionality, a new optional parameter with a sensible default, a new CLI flag.
- **Patch** (`0.0.X`): a backward-compatible fix — bug fixes, performance improvements, documentation, internal refactors with no observable API change.
- When in doubt between major and minor: if any correct, reasonable existing usage could break, it's major — "probably nobody depends on that" is not the same as "nobody could."
- Check the actual diff against the *public* API surface (what's exported/documented), not the whole diff — an internal refactor touching many files can still be a patch release if nothing public changed.
- Update the version in every place the project tracks it (`package.json`, `Cargo.toml`, `pyproject.toml`, a `__version__` string) — check for more than one location before assuming a single edit is complete.
