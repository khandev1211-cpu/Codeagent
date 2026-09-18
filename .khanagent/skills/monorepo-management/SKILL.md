---
name: monorepo-management
description: Work effectively within a monorepo (multiple packages/apps in one repository). Use when adding a new package, managing cross-package dependencies, or reviewing monorepo structure.
allowed-tools: read_file, write_file, edit_file, run_bash, search_code
---

# Monorepo Management

- Use the project's existing monorepo tooling (Nx, Turborepo, Lerna, pnpm/yarn workspaces, Bazel) rather than manually managing cross-package dependencies — these tools exist specifically to handle build caching, task orchestration, and dependency graphs correctly.
- Understand actual package boundaries before adding a cross-package dependency — a new dependency between packages should reflect a genuine need, not just "the code happened to be convenient to import from there."
- Run affected-only builds/tests where the tooling supports it (build/test only what changed and what depends on it) rather than always running everything — this is usually the whole point of monorepo tooling's caching.
- Keep shared code in genuinely shared packages with clear ownership, rather than one app reaching directly into another app's internal files that weren't meant to be a public package interface.
- Version internal packages consistently with the monorepo's actual convention (independently versioned vs. all packages moving together) — check before assuming.
- Watch for circular dependencies between packages — most monorepo tools will catch this, but understand why it's a problem (breaks independent buildability) rather than just satisfying the tool.
