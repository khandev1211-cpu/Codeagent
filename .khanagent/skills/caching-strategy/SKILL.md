---
name: caching-strategy
description: Design or review a caching approach for expensive or frequently-accessed data. Use when adding caching, or reviewing cache invalidation bugs.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Caching Strategy

- The two hardest parts are invalidation and staleness tolerance — decide explicitly how stale data is acceptable to be for this specific use case before choosing a TTL or invalidation strategy.
- Cache at the right layer: a CDN for static/public assets, an application-level cache (Redis/in-memory) for computed/queried data, HTTP caching headers for cacheable API responses — don't default to one layer for everything.
- Explicit invalidation (clear the cache entry when the underlying data changes) is more correct than a short TTL alone when correctness matters more than a slight implementation cost — a short TTL is a simpler fallback for data where brief staleness is genuinely fine.
- Cache keys need to include everything that affects the cached value (user ID, locale, query parameters) — a cache key missing a relevant dimension causes one user to see another's cached data.
- Handle cache failures gracefully (fall through to the real source) rather than letting a cache outage take down the whole feature — a cache should be a performance optimization, not a new single point of failure.
- Don't cache something that's cheap to compute and rarely accessed — caching has its own complexity cost and isn't free just because it's possible.
