---
name: rate-limiting-implementation
description: Implement rate limiting for an API or a client calling an external service. Use when adding rate limiting, or handling rate limits imposed by a third-party API.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Rate Limiting Implementation

**Implementing rate limiting on your own API:**
- Choose a scheme deliberately (fixed window, sliding window, token bucket) — a naive fixed window allows a burst at the window boundary (2x the limit in a short span), which a sliding window or token bucket avoids.
- Return the standard rate-limit headers (`X-RateLimit-Remaining`, `Retry-After` on a 429) so well-behaved clients can self-throttle instead of hammering the endpoint on every retry.
- Rate-limit by the right key (per-user, per-API-key, per-IP) matching what's actually being protected against — IP-based limiting is easy to defeat and inappropriate for authenticated APIs where a per-user/per-key limit is more correct.

**Respecting a third-party API's rate limit as a client:**
- Read and respect the actual response headers/error codes the API provides (`Retry-After`, a 429 status) rather than guessing at a safe request rate.
- Implement exponential backoff with jitter on 429/5xx responses, not a fixed retry delay — fixed delays from many clients retrying in lockstep can synchronize into further bursts.
- Batch/queue requests to stay under the limit proactively for predictable high-volume usage, rather than only reacting after hitting 429s.
