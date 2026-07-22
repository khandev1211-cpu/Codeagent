---
name: kotlin-practices
description: Write idiomatic Kotlin. Use when writing or reviewing Kotlin code, typically for Android or JVM backend development.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Kotlin Practices

- Null safety: use the type system (`String?` vs `String`) rather than defensive null checks everywhere; prefer `?.`/`?:`/`let` over force-unwrap (`!!`), which should be rare and deliberate.
- Data classes for simple value-holding types, rather than manually writing `equals`/`hashCode`/`toString`.
- Prefer immutable (`val`) over mutable (`var`) properties and immutable collection types (`List` over `MutableList`) unless mutation is genuinely needed.
- Use coroutines for async work following the project's existing structured-concurrency conventions (scope, dispatcher usage) rather than introducing raw threads or a different async pattern.
- Extension functions for adding behavior to a type you don't own, rather than a static utility class — but don't overuse them to the point of making it unclear where a method actually lives.
- Run `ktlint`/the project's configured formatter after edits (`run_bash`).
