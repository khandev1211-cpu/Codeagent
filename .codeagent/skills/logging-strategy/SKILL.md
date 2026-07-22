---
name: logging-strategy
description: Add or review application logging. Use when instrumenting new code with logs, or reviewing whether existing logging is adequate for debugging production issues.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Logging Strategy

- Use the project's existing structured logging convention (a logger library with levels, structured fields) rather than raw `console.log`/`print` statements for anything beyond quick local debugging.
- Log at the right level: `error` for things that need attention, `warn` for degraded-but-recovered situations, `info` for significant business events, `debug` for detail only useful when actively troubleshooting — don't log everything at `info` by default.
- Include context that makes a log line useful without needing to cross-reference other logs: a request ID, user ID (if not sensitive), the relevant entity ID — not just "operation failed."
- Never log secrets, full credit card numbers, passwords, or raw auth tokens — even at debug level, since debug logs still often end up somewhere persisted.
- Log the *why*, not just the *what*, for errors — "failed to charge card: insufficient funds" is more useful than "payment error."
- Don't log so much that the signal is buried — a log line for every loop iteration in a hot path is usually noise, not insight.
