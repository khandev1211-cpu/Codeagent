---
name: pagination-design
description: Design or review how a list endpoint paginates results. Use when adding a new list endpoint or fixing pagination bugs (missing/duplicate results across pages).
allowed-tools: read_file, write_file, edit_file, search_code
---

# Pagination Design

1. Cursor-based pagination (an opaque cursor pointing to "after this item") over offset-based (`?page=3`) for anything where the underlying data can change between requests — offset pagination silently skips or duplicates items when rows are inserted/deleted between page fetches.
2. Offset-based is fine, and simpler, for genuinely static or rarely-changing datasets where "page 3" as a concept matters to the caller (e.g. a UI with page number links).
3. Always include a stable, explicit sort order — pagination without a defined `ORDER BY` (or equivalent) is undefined behavior across pages, even if it happens to look consistent in testing.
4. Return whether more results exist (a `has_more` flag or a `next_cursor` that's null/absent at the end) rather than making the caller guess from a possibly-shorter-than-requested page.
5. Cap the maximum page size the API will honor, regardless of what the caller requests — an unbounded `?limit=999999` is a real resource-exhaustion risk.
6. Check the project's existing pagination convention on other list endpoints before introducing a different style for a new one.
