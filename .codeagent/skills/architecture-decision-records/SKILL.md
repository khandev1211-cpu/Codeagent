---
name: architecture-decision-records
description: Write an Architecture Decision Record (ADR) documenting a significant technical decision. Use when asked to document a decision, or after making a non-obvious architectural choice worth recording.
allowed-tools: read_file, write_file
---

# Architecture Decision Records

1. Check for an existing ADR convention/directory (`docs/adr/`, `decisions/`) and format before inventing a new one.
2. Structure: context (what problem/situation prompted this decision), the decision itself (stated plainly, not hedged), and consequences (what this makes easier, what it makes harder, what was given up by not choosing an alternative).
3. Record the alternatives that were genuinely considered and why they were rejected — not just the option that was chosen, since "why not X" is often the most valuable part of an ADR for someone reading it later.
4. Write it at the time the decision is made, not reconstructed from memory months later — capture the actual reasoning and constraints that were live at the time.
5. ADRs are typically immutable once accepted — a later decision that changes course gets a new ADR referencing/superseding the old one, not an edit that erases the original reasoning.
6. Keep it factual and specific — "we chose Postgres over MongoDB because the data is relational and we need transactional guarantees across orders and inventory," not "we chose Postgres because it's better."
