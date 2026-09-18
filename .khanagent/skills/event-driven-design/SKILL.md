---
name: event-driven-design
description: Design an event-driven flow (publish/subscribe, event sourcing, message-based integration). Use when adding asynchronous, event-based communication between components or services.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Event-Driven Design

- Name events for what happened (past tense: `OrderPlaced`, `PaymentFailed`), not commands (`PlaceOrder`) — an event is a fact that occurred, not an instruction, and that distinction shapes correct usage.
- Keep events focused and immutable — an event's shape shouldn't need to change after the fact; if the data needed by consumers changes, that's usually a new event version, not a mutation.
- Decide delivery guarantees explicitly (at-least-once is the common default) and design consumers to be idempotent accordingly, the same reasoning as worker-queue-design — a consumer that isn't safe to run twice on the same event is a real, common bug.
- Avoid a consumer needing to know too much about the producer's internals — an event should be a stable public contract, not a dump of internal state that couples consumers to implementation details.
- For event sourcing specifically (state derived by replaying events, not stored directly): understand this is a significant architectural commitment with real complexity (event schema evolution, snapshotting for replay performance) — don't adopt it for a system that just needs simple pub/sub notifications.
- Make failure visible — a dropped or unprocessable event should be observable (a dead-letter queue, logging, alerting), not silently lost.
