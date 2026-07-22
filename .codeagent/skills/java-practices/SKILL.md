---
name: java-practices
description: Write idiomatic modern Java. Use when writing or reviewing Java code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Java Practices

- Check the project's actual Java version (`pom.xml`/`build.gradle`) before using newer syntax — records, sealed classes, and pattern matching in switch are version-gated features, not universally available.
- Prefer immutability: `final` fields, records for simple data carriers, builders for complex construction — over mutable beans with a dozen setters.
- `Optional<T>` for a method's return value when absence is a real, expected case — not as a replacement for every nullable field, and never as a method parameter type.
- Use the project's existing dependency-injection convention (Spring, Guice, manual) rather than introducing a new one for a single class.
- Checked exceptions: only introduce a new one if callers genuinely need to handle it differently from a runtime exception — don't default to checked just because that's the older convention.
- Run the project's build tool (Maven/Gradle) after non-trivial edits to catch compile errors before declaring the task done.
