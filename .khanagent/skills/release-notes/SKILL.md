---
name: release-notes
description: Write release notes for a version, aimed at users deciding whether to upgrade. Use when cutting a release, distinct from the ongoing changelog.
allowed-tools: read_file, run_bash
---

# Release Notes

1. Pull the actual set of changes since the last release (`git log <last-tag>..HEAD`, or the accumulated `[Unreleased]` changelog section, `run_bash`/`read_file`) rather than reconstructing from memory.
2. Lead with what matters most to a user deciding whether to upgrade — a headline feature or an important fix — not a flat chronological list of every commit.
3. Call out breaking changes prominently and separately, with concrete migration guidance if the fix isn't obvious ("rename `oldOption` to `newOption` in your config").
4. Group related changes together (all the API additions, then fixes, then internal notes) rather than presenting them in commit order, which rarely matches what a reader cares about.
5. Credit is worth getting right if the project does that — check the actual contributors for this range rather than guessing.
6. Keep internal/non-user-facing changes out, or clearly separated at the bottom — release notes are for the person deciding whether to upgrade, not a full audit log.
