---
name: query-optimization
description: Diagnose and fix a slow database query. Use when asked to optimize a query or investigate slow database performance.
allowed-tools: read_file, run_bash, search_code
---

# Query Optimization

1. Measure first — get the actual query plan (`EXPLAIN`/`EXPLAIN ANALYZE` or equivalent, `run_bash`) rather than guessing at what's slow.
2. Look for the classic culprits: missing index on a filtered/joined column, an N+1 query pattern (one query per row instead of one query total), a `SELECT *` pulling far more data than needed, an unnecessary full table scan.
3. Add an index only where the query plan actually shows it would help — an unused index still costs write performance and storage, so it's not a free "add more indexes" fix.
4. For N+1 patterns specifically: batch into a single query with a `JOIN` or an `IN (...)`, or use the ORM's eager-loading feature if one exists, rather than optimizing each individual query in a loop.
5. Re-measure after the change — confirm the fix actually improved the query plan, not just "it feels faster."
6. Consider whether the query is even necessary at this frequency — sometimes the right fix is caching the result, not making the underlying query faster.
