---
name: code-smell-detection
description: Identify code smells — patterns that indicate a deeper problem even though the code technically works. Use during review, or when asked to assess code quality.
allowed-tools: read_file, search_code
---

# Code Smell Detection

Look for, and name explicitly when found (don't just vaguely say "this could be cleaner"):

- **Long function/method** doing several unrelated things — a signal it should be split.
- **Duplicated logic** across multiple places that will drift out of sync the next time one copy gets updated and the others don't.
- **Primitive obsession** — passing around loose strings/numbers where a small type or enum would catch mistakes at compile/parse time instead of at runtime.
- **Feature envy** — a function that mostly operates on another object's data, suggesting it belongs on that object instead.
- **Shotgun surgery risk** — a single logical change that would require edits across many unrelated files, suggesting a missing abstraction.
- **God object/module** — one file or class that knows about and controls far more than its name suggests.
- **Magic numbers/strings** with no named constant explaining what they mean or why that specific value.

For each one flagged, say concretely why it's a problem *for this codebase* (not smell-detection as an abstract exercise) — what would actually go wrong or get harder as a result of leaving it.
