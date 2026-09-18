---
name: orm-best-practices
description: Use an ORM (Prisma, SQLAlchemy, ActiveRecord, TypeORM, GORM, etc.) correctly and avoid its common pitfalls. Use when writing or reviewing ORM-based data access code.
allowed-tools: read_file, write_file, edit_file, search_code
---

# ORM Best Practices

- Watch for N+1 queries — accessing a related object in a loop without eager-loading it first is the single most common ORM performance bug across every framework.
- Don't fetch more than you need — select specific fields when the ORM supports it, rather than always hydrating full model objects for read-only display data.
- Use the ORM's transaction API for multi-step writes that need to succeed or fail together, rather than relying on the assumption that nothing will fail between them.
- Raw SQL is fine, and often correct, when the ORM's query builder would be more awkward or less efficient than the equivalent SQL — don't force everything through the abstraction if it's fighting you.
- Match the project's existing model/repository conventions (where validation lives, whether business logic lives on the model or a separate service layer) rather than introducing a new pattern for one new model.
- Be deliberate about lazy vs. eager loading — the ORM's default isn't always the right choice for a specific access pattern.
