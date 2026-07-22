---
name: cdn-caching-strategy
description: Configure CDN and HTTP caching correctly for static and dynamic content. Use when setting up or reviewing CDN/cache-control configuration.
allowed-tools: read_file, write_file, edit_file
---

# CDN & HTTP Caching Strategy

- Set `Cache-Control` deliberately per resource type — long `max-age` plus a content-hashed filename for static assets (safe to cache aggressively since the URL itself changes when content changes), short or no caching for dynamic/personalized content.
- Never cache responses containing user-specific/sensitive data at a shared cache layer (CDN) without `private`/`no-store` as appropriate — a cached response meant for one user being served to another is a real, serious data-leak class of bug.
- Use cache-busting (content hash in the filename, or a version query param) for assets that need to update — relying on cache expiry alone means users can be stuck on a stale version until the TTL passes.
- Understand the difference between browser cache and CDN/edge cache — headers and invalidation can behave differently at each layer, and a fix that clears the CDN cache doesn't necessarily clear what's cached in a returning user's browser.
- For content that changes but should still be cached, consider stale-while-revalidate semantics if the CDN supports it — serves the (slightly stale) cached version instantly while refreshing in the background, rather than making every user wait on a cache miss.
- Test actual cache behavior (headers returned, whether a purge actually propagates) against the real CDN configuration, not just the application's intended header values.
