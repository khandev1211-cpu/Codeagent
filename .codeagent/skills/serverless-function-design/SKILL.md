---
name: serverless-function-design
description: Design or review a serverless function (AWS Lambda, Cloudflare Workers, Vercel/Netlify functions). Use when writing new serverless functions or reviewing their design.
allowed-tools: read_file, write_file, edit_file
---

# Serverless Function Design

- Keep functions focused on one thing — a single Lambda handling many unrelated routes/triggers loses most of the benefit (independent scaling, independent deploy, clear ownership) that serverless is meant to provide.
- Design for statelessness explicitly — nothing can be assumed to persist in memory between invocations (a "warm" instance is an optimization detail, not a guarantee), so any needed state goes in a database/cache, not a module-level variable expected to survive.
- Minimize cold-start cost: keep dependencies/bundle size lean, and initialize expensive resources (a database connection) outside the handler function so they can be reused across invocations when the runtime does stay warm, without depending on it.
- Set an explicit timeout appropriate to the function's actual expected duration, not the platform's default/maximum — a runaway function should fail fast, not hang until a generous ceiling.
- Handle retries and idempotency the same way as the worker-queue-design skill — most serverless trigger sources (queues, event buses) have at-least-once delivery semantics.
- Watch for functions calling other functions synchronously in a chain — this can silently create tightly coupled, hard-to-debug latency chains that a more explicit async/event-based design would avoid.
