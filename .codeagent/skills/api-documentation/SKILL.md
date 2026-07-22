---
name: api-documentation
description: Write or update documentation for an API endpoint. Use when adding a new endpoint, changing behavior, or asked to document an API.
allowed-tools: read_file, write_file, edit_file, search_code
---

# API Documentation

1. Check whether the project uses a spec format (OpenAPI/Swagger, GraphQL schema comments, a docs generator reading code annotations) before hand-writing prose docs that could drift from the generated ones.
2. For each endpoint: method + path, required and optional parameters (with types and whether each is required), a realistic example request and response, and every meaningful error/status code it can return — not just the happy path.
3. Show a real, working example, not a placeholder like `{...}` — a copy-pasteable example is far more useful than an abstract schema description alone.
4. Document authentication requirements explicitly per endpoint if they vary (some public, some requiring a token/scope) rather than only in a general "auth" section a reader might miss.
5. Keep documentation next to the code it describes when the project's convention supports that (docstrings/annotations that generate the docs) — documentation that lives far from the code it describes drifts out of sync faster.
6. When updating an existing endpoint's behavior, update its documentation in the same change, not as a follow-up that may or may not happen.
