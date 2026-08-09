---
name: database-migrations
description: Write a safe database migration. Use when adding, changing, or removing schema, or asked to write a migration file.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Database Migrations

- Use the project's existing migration tool/convention (found by checking for a `migrations/` directory or config) — don't hand-write raw SQL against a project that uses an ORM's migration system.
- Every migration needs a working rollback (`down`) unless the project's convention explicitly doesn't use them — an irreversible migration is a real operational risk.
- Additive changes (new nullable column, new table) are safe to deploy before the application code that uses them; destructive changes (dropping a column, making a column required) need a multi-step rollout if the system can't have simultaneous downtime for old and new code.
- Never edit a migration that's already been applied/merged — write a new migration to fix it, the same way you'd never edit a merged git commit's history on a shared branch.
- For a large table, consider whether the migration needs to run in batches rather than one long-locking `ALTER TABLE` — check the project's conventions or database size before assuming a simple migration is safe at scale.
- Test the migration against a copy of realistic data if possible, not just an empty test database.
