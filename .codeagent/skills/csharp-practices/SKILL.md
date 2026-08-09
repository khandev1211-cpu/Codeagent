---
name: csharp-practices
description: Write idiomatic modern C#. Use when writing or reviewing C# code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# C# Practices

- Nullable reference types: if the project has them enabled (`<Nullable>enable</Nullable>`), respect the annotations rather than sprinkling `!` null-forgiving operators to silence warnings.
- `async`/`await` all the way down — don't block on async code with `.Result`/`.Wait()`, which risks deadlocks in certain contexts (e.g. UI/ASP.NET sync contexts) and defeats the purpose of async in the first place.
- LINQ for collection transforms where it's at least as readable as a loop; drop to a loop when LINQ chains get hard to follow or when the loop is meaningfully more efficient for the case.
- Records for immutable data carriers over classes with a full complement of hand-written getters/setters.
- Use the project's existing DI convention (constructor injection is standard in most ASP.NET Core projects) rather than introducing service location for a new class.
- Run `dotnet format`/the project's analyzer after edits (`run_bash`) rather than hand-matching style.
