---
name: layered-architecture
description: Structure code into clear layers (presentation, business logic, data access) with correct dependency direction. Use when organizing a new module or reviewing architectural boundaries.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Layered Architecture

- Dependencies point inward/downward only — presentation depends on business logic, business logic depends on data-access abstractions, never the reverse. A business-logic module importing something from the presentation layer is a boundary violation worth flagging.
- Business logic shouldn't know about HTTP/the framework/the database's specific technology — a service function shouldn't take an Express `req`/`res` directly, or a raw SQL row shape, if it's meant to be reusable business logic and not presentation- or persistence-specific code.
- Keep the data-access layer behind an interface/abstraction the business logic depends on, not the concrete ORM/database client directly — this is what actually makes swapping persistence or writing fast unit tests (with a fake) possible.
- Don't over-layer a genuinely small application — three enforced layers with strict boundaries for a 200-line CRUD script is needless ceremony; match the structure to the actual size and expected lifespan of the codebase.
- When reviewing, check actual import directions against this rule directly (`search_code` for imports crossing the wrong way) rather than assuming the boundary is respected because the folders are named correctly.
