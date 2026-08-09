---
name: writing-technical-specs
description: Write a technical design/spec document for a proposed change before implementing it. Use when asked to write a design doc, RFC, or technical spec.
allowed-tools: read_file, write_file, search_code
---

# Writing Technical Specs

1. State the problem before the solution — a reader needs to understand what's actually being solved and why it matters before evaluating whether the proposed approach is right.
2. Cover the alternatives genuinely considered and why they were rejected, not just the chosen approach presented as the only option — this is often the most useful part of a spec for a reviewer.
3. Be concrete about scope: what this change does and, explicitly, what it does not do — an unstated scope boundary is a common source of scope creep or reviewer confusion later.
4. Call out risks and open questions honestly rather than presenting the plan as if every detail is already resolved — a spec that hides uncertainty just moves the discovery of problems later, to implementation time.
5. Include enough concrete detail (data model changes, API shape, rollout plan) that a reviewer could actually evaluate feasibility, not just intent — "we'll add caching" without saying where/how doesn't let anyone assess it.
6. Match the project's existing spec template/process if one exists rather than inventing a new structure.
