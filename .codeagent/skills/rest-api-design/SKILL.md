---
name: rest-api-design
description: Design or review a REST API's resource shape, routes, and HTTP semantics. Use when adding a new endpoint or reviewing existing API design.
allowed-tools: read_file, write_file, edit_file, search_code
---

# REST API Design

1. Resources are nouns, actions are HTTP methods — `POST /orders`, not `POST /createOrder`. If an operation genuinely doesn't map to a resource+method, that's a signal to reconsider the shape, not a reason to invent a verb-based route.
2. Use HTTP status codes for what they actually mean: 200 (success), 201 (created, with a `Location` header), 204 (success, no body), 400 (client error, malformed request), 401/403 (auth), 404 (not found), 409 (conflict), 422 (validation failure), 500 (server error). Don't return 200 with an error payload.
3. Consistent naming across the whole API — if one endpoint uses `camelCase` and another `snake_case` for the same kind of field, that's a bug, not a style choice.
4. Nest resources only when the relationship is genuinely hierarchical and the child can't exist independently (`/orders/:id/line-items`) — don't nest for convenience when a flat resource with a filter (`/line-items?order_id=`) is more accurate.
5. Idempotency: `PUT`/`DELETE` should be safe to retry with the same result; `POST` for a genuinely new resource typically isn't, and callers need to know that.
6. Check the existing API's conventions before adding a new endpoint — match its patterns (auth headers, error shape, pagination style) rather than introducing a new one for this single endpoint.
