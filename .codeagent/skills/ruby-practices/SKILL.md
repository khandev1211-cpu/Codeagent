---
name: ruby-practices
description: Write idiomatic Ruby. Use when writing or reviewing Ruby code, especially in a Rails project.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Ruby Practices

- Follow existing conventions closely — Ruby (and especially Rails) leans heavily on convention over configuration; deviating from the expected file/method naming breaks framework "magic" that depends on it.
- Prefer `each`/`map`/`select` and other Enumerable methods over manual `for` loops or index-based iteration.
- Guard clauses (`return unless valid?`) over deeply nested conditionals.
- In Rails specifically: keep business logic out of controllers and views — a fat controller or a view with embedded business logic is a common, specifically-Rails code smell.
- Run `rubocop` after edits if the project has it configured (`run_bash`) — Ruby style conventions are fairly opinionated and codified.
- Symbols (`:name`) over strings for internal keys/identifiers that aren't user-facing text.
