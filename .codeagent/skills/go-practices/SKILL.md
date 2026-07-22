---
name: go-practices
description: Write idiomatic Go. Use when writing or reviewing Go code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Go Practices

- Errors are values — check them immediately after the call that can produce them, don't defer error handling to "later in the function."
- Return early on error rather than nesting the happy path inside an `if err == nil` block.
- Named return values only when they genuinely clarify the function's contract, not by default.
- `gofmt`/`goimports` after every edit (`run_bash`) — Go's formatting is not a style preference, it's the convention, and unformatted Go is an immediate signal something was hand-edited carelessly.
- Small, focused interfaces defined at the point of use (consumer side), not large interfaces defined alongside the implementation.
- Avoid unnecessary goroutines/channels for code that's simpler as a plain sequential call — concurrency should solve a real problem in this specific code, not be reflexive.
- Check `go.mod` for the module's actual Go version before using a language feature — generics (1.18+), for instance, aren't always available.
