---
name: input-validation
description: Add or review input validation for user-supplied data. Use when handling form input, API request bodies, file uploads, or any external input.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Input Validation

- Validate on the server/backend regardless of any client-side validation that also exists — client-side validation is a UX convenience, never a security boundary, since it can always be bypassed.
- Use the project's existing validation library/convention (a schema validator, a framework's built-in validation) rather than hand-rolling ad-hoc checks for a new field.
- Validate shape, type, range, and format explicitly — "is a string" is rarely sufficient; check length limits, allowed characters, numeric bounds where they matter.
- Reject invalid input with a clear error rather than silently coercing it into something "close enough" — silent coercion hides bugs and can hide security issues.
- For anything that becomes part of a database query, shell command, file path, or HTML output: validate against expected shape *and* ensure it's handled safely at the point of use (parameterized queries, not string concatenation; path sanitization against traversal) — validation of shape doesn't replace safe handling at the sink.
- Don't trust size/count implicitly — cap array lengths, string lengths, and file sizes explicitly rather than assuming reasonable input.
