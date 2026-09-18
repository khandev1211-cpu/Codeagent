---
name: worker-queue-design
description: Design a background job/worker queue system. Use when adding asynchronous background processing (job queues, task workers).
allowed-tools: read_file, write_file, edit_file, search_code
---

# Worker Queue Design

- Jobs should be idempotent where at all possible — a queue with at-least-once delivery (the common case) can redeliver a job, and a non-idempotent job (e.g. "charge the customer") run twice is a real bug, not a theoretical edge case.
- Design explicit retry behavior: how many attempts, what backoff strategy, and what happens after retries are exhausted (a dead-letter queue, an alert) — a job that silently disappears after failing is worse than one that fails loudly.
- Keep job payloads small and reference data by ID rather than embedding large objects — the underlying data can change between when a job is enqueued and when it runs, and a stale embedded snapshot is a common source of confusing bugs.
- Make jobs observable — log/track when a job starts, completes, or fails, with enough context (job type, relevant ID) to investigate a specific failure without re-deriving it from scratch.
- Consider job priority/ordering requirements explicitly — most queue systems don't guarantee strict ordering by default, and code that implicitly assumes FIFO processing can be a real bug.
- Match the project's existing queue technology and conventions (Sidekiq, BullMQ, Celery, SQS-based) rather than introducing a new one for a single new job type.
