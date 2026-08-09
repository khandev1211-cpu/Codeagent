---
name: swift-practices
description: Write idiomatic Swift. Use when writing or reviewing Swift code, typically for iOS/macOS development.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Swift Practices

- Prefer `let` over `var` by default — mutability should be intentional and visible at the declaration site.
- Optionals: use `guard let`/`if let` to unwrap safely; force-unwrap (`!`) only where a nil value would genuinely represent a programmer error, not a real runtime possibility.
- Value types (`struct`) by default, reference types (`class`) when identity or shared mutable state is actually needed — don't default to classes out of habit from other languages.
- Use Swift's error handling (`throws`/`try`/`catch`, `Result<T, Error>`) rather than returning optional values or sentinel values to signal failure.
- Match the project's existing concurrency model (async/await vs. completion handlers vs. Combine) rather than introducing a new one for a single new function.
- Run `swiftformat`/`swiftlint` after edits if configured (`run_bash`).
