---
name: api-versioning
description: Decide how and when to version an API, and how to make a breaking change safely. Use when a change to an API would break existing callers.
allowed-tools: read_file, search_code
---

# API Versioning

1. First check whether the change is actually breaking — adding a new optional field or a new endpoint isn't; removing/renaming a field, changing a field's type, or changing existing behavior is.
2. Check the project's existing versioning convention (URL path `/v2/`, a header, a query param) before introducing a different mechanism for one change.
3. Prefer additive, backward-compatible changes over a version bump when possible — a new optional field beats a breaking rename.
4. When a breaking change is genuinely necessary: support both versions during a deprecation window if there are real external callers, with the deprecated version clearly marked and a removal timeline communicated, not silently pulled.
5. Version the contract, not the implementation — internal refactors that don't change the API surface don't need a new version.
6. Document what changed between versions concretely (field X removed, field Y now required) — "various improvements" doesn't help a caller migrate.
