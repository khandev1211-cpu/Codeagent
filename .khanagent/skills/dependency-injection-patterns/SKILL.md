---
name: dependency-injection-patterns
description: Use dependency injection correctly to keep code testable and decoupled. Use when structuring how a class/module obtains its dependencies.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Dependency Injection Patterns

- Depend on interfaces/abstractions for anything that needs to be swapped in tests (a database, an external API client) or could reasonably have multiple implementations — not for every single dependency reflexively, which just adds indirection with no real benefit.
- Prefer constructor injection over a DI container/framework's "magic" auto-wiring for anything where explicitness helps readability — but match whatever convention the project has already committed to rather than introducing a second style.
- A class needing many injected dependencies is often a sign it has too many responsibilities (see reducing-complexity) — DI makes the problem visible rather than hidden behind internal `new SomeService()` calls, which is useful signal, not something to work around by simplifying the injection instead of the class.
- Don't inject things that don't need to vary (a pure utility function, a constant) — injection is for genuine dependencies with a lifecycle or a need to be substituted, not a blanket pattern applied to everything.
- Keep the composition root (where all the concrete implementations actually get wired together) in one clear place rather than scattered construction logic throughout the codebase.
