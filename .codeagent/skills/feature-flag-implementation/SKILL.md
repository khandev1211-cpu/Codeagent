---
name: feature-flag-implementation
description: Implement a feature flag to control a feature's rollout. Use when adding a feature flag, or reviewing feature-flagged code.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Feature Flag Implementation

- Use the project's existing feature-flag system/library if one exists rather than a one-off boolean in config — a real flag system typically gives targeting (by user, percentage rollout) and a way to change the flag without a deploy.
- Keep flag-checking logic at the boundary/entry point of the flagged behavior, not scattered checks of the same flag deep inside multiple unrelated functions — this keeps the blast radius of the flag clear and the eventual cleanup simpler.
- Plan the flag's removal from the start — a feature flag is meant to be temporary; note when/how it should be cleaned up once the feature is fully rolled out and stable, rather than letting it become permanent dead-code-adjacent complexity.
- Test both states of the flag explicitly (on and off) — a bug only occurring when the flag is in the less-commonly-tested state is a common, avoidable gap.
- Don't let flagged and unflagged code diverge silently over time (a bug fixed in the new path but not backported to the old path still being served to some users) — track both paths as long as the flag exists.
- For a kill-switch-style flag (able to quickly disable a risky feature), make sure disabling it is genuinely fast and doesn't require a deploy — that's the whole point of having it.
