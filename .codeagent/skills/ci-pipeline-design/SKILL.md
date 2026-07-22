---
name: ci-pipeline-design
description: Design or review a CI pipeline (GitHub Actions, GitLab CI, CircleCI, etc.). Use when setting up CI for a project or fixing a slow/flaky pipeline.
allowed-tools: read_file, write_file, edit_file
---

# CI Pipeline Design

- Fail fast: run the cheapest, fastest checks first (lint, type-check) before expensive ones (full test suite, e2e) — a broken lint rule shouldn't wait behind a 10-minute test run to be reported.
- Cache dependencies (package manager cache) between runs — reinstalling from scratch every run is one of the most common sources of slow CI.
- Run independent jobs in parallel (lint, unit tests, and a build can usually all run at once) rather than one long sequential pipeline.
- Pin action/tool versions explicitly rather than floating on `latest` — a CI pipeline that silently changes behavior because an upstream action updated is a real, hard-to-diagnose failure mode.
- Make required checks actually required (branch protection) — a CI check that can be ignored isn't providing the safety it looks like it's providing.
- For flaky tests: fix or quarantine them explicitly, don't just add a blanket retry — a retry that masks a real intermittent bug (a race condition) just delays finding it.
