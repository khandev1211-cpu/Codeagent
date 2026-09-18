---
name: rust-practices
description: Write idiomatic, safe Rust. Use when writing or reviewing Rust code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Rust Practices

- Prefer `Result<T, E>` and `?` for error propagation over `.unwrap()`/`.expect()` in anything that isn't a test or a genuinely-should-never-fail invariant — and if you do use `.expect()`, put the actual reason in the message, not a generic one.
- Borrow before you clone — `.clone()` is a fallback for when the borrow checker genuinely can't be satisfied, not a first response to a lifetime error.
- Run `cargo fmt` and `cargo clippy` after edits (`run_bash`) — clippy catches real idiom violations, not just style nits.
- Prefer iterators and combinators (`.map()`, `.filter()`, `.fold()`) over manual index-based loops where they're equally clear.
- Check `Cargo.toml`'s edition and dependency versions before assuming a language feature or crate API is available.
- Public API surface: `pub` deliberately, not reflexively — default to private and widen only when something actually needs to be called from outside the module.
