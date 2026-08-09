---
name: dependency-updates
description: Update project dependencies safely. Use when asked to update, upgrade, or bump dependencies, or to address a dependency vulnerability.
allowed-tools: read_file, run_bash, edit_file
---

# Dependency Updates

1. Check current versions and what's actually outdated first (`npm outdated`, `pip list --outdated`, `cargo outdated`, or equivalent, `run_bash`) rather than assuming everything needs updating.
2. Read the changelog/release notes for anything crossing a major version boundary before updating — a patch/minor bump is usually safe to batch; a major bump needs its own attention for breaking changes.
3. Update in reasonably small batches rather than "update everything to latest" in one pass, especially for a project with many dependencies — this keeps a resulting test failure traceable to a specific update.
4. Run the full test suite after each batch (`run_bash`) before moving to the next.
5. For a security-driven update (a reported vulnerability), check whether the minimum patched version is enough, or whether the fix requires a larger jump — don't over-update past what's needed to resolve the vulnerability if a larger jump introduces unrelated risk.
6. Update the lockfile, not just the manifest version range — `package.json` alone without `package-lock.json`/`yarn.lock` regenerated doesn't actually pin what gets installed.
