---
name: domain-modeling
description: Model the core business domain in code accurately, using the actual business's vocabulary and rules. Use when designing new domain entities/logic, or reviewing whether existing models match real business rules.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Domain Modeling

- Use the business's actual vocabulary in code (class/function names matching what domain experts call things), not a generic technical rename — a mismatch between code terminology and how the business talks about the domain is a constant source of miscommunication and subtle bugs.
- Make illegal states unrepresentable where the type system allows it — if an `Order` can never legally have a `shippedAt` date before its `placedAt` date, model that constraint structurally where possible rather than relying on scattered runtime checks.
- Keep domain logic (business rules) separate from infrastructure concerns (how it's persisted, how it's exposed over HTTP) — see layered-architecture; a domain model entangled with its database representation is hard to reason about and hard to test.
- Model based on actual current business rules, verified with whoever owns that knowledge if it's not clear from the code/docs — don't guess at business rules from assumption, since a wrong assumption baked into the model is expensive to unwind later.
- Value objects (immutable, defined by their value, like `Money` or `EmailAddress`) over primitive strings/numbers for domain concepts with their own rules (currency handling, validation) — this is the same principle as "primitive obsession" in code-smell-detection, applied specifically to the domain layer.
