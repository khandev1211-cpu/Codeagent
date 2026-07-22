---
name: api-error-handling
description: Design or review how an API reports errors to callers. Use when adding error handling to an API endpoint or reviewing an inconsistent error response shape.
allowed-tools: read_file, write_file, edit_file, search_code
---

# API Error Handling

1. Use a single, consistent error response shape across the whole API — a caller shouldn't need to know which endpoint they hit to know where to find the error message.
2. Include a machine-readable error code/type in addition to a human-readable message — callers need to branch on something more stable than message text, which might change wording.
3. Validation errors: report *all* the fields that failed, not just the first one — a caller shouldn't have to fix one field, resubmit, and discover a second unrelated error.
4. Don't leak internals in error messages returned to the client — a raw stack trace or database error string is both a security risk and unhelpful to the caller; log the detail internally, return something actionable externally.
5. Distinguish "this request is malformed" (4xx, caller's fault, don't retry as-is) from "something went wrong on our end" (5xx, caller can retry) — conflating them makes it impossible for a caller to build sane retry logic.
6. Check the project's existing error-handling middleware/convention before adding a new ad-hoc error format for one endpoint.
