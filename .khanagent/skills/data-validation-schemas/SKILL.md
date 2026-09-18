---
name: data-validation-schemas
description: Define and use a schema to validate structured data (API payloads, config files, data imports). Use when adding validation for structured input.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Data Validation Schemas

- Use the project's existing schema/validation library (Zod, Joi, Pydantic, JSON Schema, etc.) rather than hand-writing ad-hoc validation checks for new data — consistency across the codebase matters more than which library is "best."
- Define the schema once and derive both validation and types/documentation from it where the tooling supports that, rather than maintaining a type definition and a separate validation schema that can drift out of sync.
- Be explicit about optional vs. required fields, and about what "optional" means (absent vs. explicitly null vs. either) — these are genuinely different contracts.
- Validate at the boundary (where external data enters the system) rather than trusting it's already valid deeper in the code — a schema defined but not actually applied at the entry point provides no real protection.
- Give specific, actionable validation error messages (which field, what was expected) rather than a generic "invalid input."
- Version the schema deliberately when it needs to change in a way that affects previously-valid data (see the api-versioning skill for the broader principle).
