---
name: schema-design
description: Design or review a database schema. Use when adding new tables/collections or reviewing existing schema design.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Database Schema Design

- Normalize by default; denormalize deliberately, only for a measured read-performance reason, and document why when you do.
- Every table needs a clear primary key and, for relationships, proper foreign keys with an explicit `ON DELETE` behavior (cascade, restrict, set null) — don't leave it as the database default without considering which is actually correct.
- Use the right type for the data — don't store dates/numbers/booleans as strings, don't use a giant `VARCHAR` where an enum/lookup table is more correct.
- Index columns that are actually queried/filtered/joined on, not preemptively — check the project's existing query patterns before adding indexes.
- Nullable columns should mean something real ("this field is genuinely optional"), not be a default you didn't think about.
- Match the project's existing naming convention (snake_case vs camelCase, singular vs plural table names) rather than introducing a new one for a new table.
