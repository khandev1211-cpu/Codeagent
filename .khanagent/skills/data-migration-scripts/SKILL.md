---
name: data-migration-scripts
description: Write a one-off script to migrate or backfill data, distinct from a schema migration. Use when transforming existing data to a new shape, backfilling a new field, or moving data between systems.
allowed-tools: read_file, write_file, run_bash
---

# Data Migration Scripts

- Make it idempotent/safe to re-run — a migration that fails partway through and needs to be re-run shouldn't double-process already-migrated rows or error out on them.
- Dry-run first — build in a mode that reports what *would* change without writing anything, and actually run it before the real migration to sanity-check the logic against real data.
- Process in batches with logging/progress, not one giant unbounded operation — this also makes it possible to pause/resume and to see it's actually progressing on a long-running migration.
- Back up the affected data (or confirm a recent backup exists) before running anything destructive against production data — a migration script bug is exactly the kind of mistake a backup exists for.
- Validate the result afterward with an explicit check (row counts, a sample comparison) rather than assuming success just because the script exited without an error.
- Keep the script itself as an artifact (committed, not run-and-deleted) so there's a record of exactly what was done to the data and when.
