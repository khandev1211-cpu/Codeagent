---
name: changelog-entry
description: Add a changelog entry for a change, following the project's existing changelog format. Use when asked to update the changelog, or as part of finishing a user-facing change.
allowed-tools: read_file, edit_file
---

# Changelog Entry

1. Read the existing `CHANGELOG.md` first — match its actual format (Keep a Changelog, a custom format, categorized by Added/Fixed/Changed, or something else) rather than assuming a convention.
2. Write for the person using the software, not for another developer reading the diff — "Fixed a crash when saving a file with no extension," not "Fixed null check in save handler."
3. Put it under the right category and the right version section (usually an `[Unreleased]` section that accumulates until the next release) — check where existing recent entries were added.
4. One entry per user-observable change — don't bundle three unrelated fixes into one bullet point just because they landed in the same commit.
5. If the change is purely internal (refactor with no behavior change, dependency bump with no functional effect), check whether the project's convention even logs those — many changelogs intentionally omit purely internal changes.
