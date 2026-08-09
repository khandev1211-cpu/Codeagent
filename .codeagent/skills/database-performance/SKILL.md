---
name: database-performance
description: Diagnose and fix database-level performance problems beyond a single slow query — connection handling, locking, overall load. Use when investigating broader database performance issues.
allowed-tools: read_file, run_bash, search_code
---

# Database Performance

1. Check connection pool configuration first for a broad "everything is slow under load" symptom — a pool that's too small causes queueing that looks like query slowness but isn't.
2. Look for lock contention — long-running transactions holding locks that block other operations are a common cause of intermittent, load-dependent slowness that doesn't show up when testing a single query in isolation.
3. Check for missing indexes across the actual query patterns the application generates in production, not just the queries that happen to be easy to find in the code.
4. Consider read replicas for genuinely read-heavy workloads, but only after confirming reads (not writes) are actually the bottleneck.
5. Batch writes where the application currently does many small individual writes in a loop, if the database/ORM supports a real bulk-insert path.
6. Measure actual database metrics (query time percentiles, connection pool utilization, lock wait time) rather than only application-level symptoms, to confirm the database is actually where the problem is before optimizing there.
