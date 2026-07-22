---
name: refactoring
description: Restructure existing code without changing its observable behavior. Use when asked to refactor, clean up, or reorganize code, as distinct from adding a feature or fixing a bug.
allowed-tools: read_file, write_file, edit_file, search_code, run_bash
---

# Refactoring

1. Confirm there's test coverage for the code being touched before starting — refactoring without a safety net is just rewriting and hoping. If coverage is missing, either add it first or say explicitly that you're proceeding without one.
2. Change structure, not behavior — if the refactor also needs a behavior change, that's two separate changes; do them as two separate steps (and ideally two commits), not tangled together.
3. Small, verifiable steps — extract a function, run tests, rename a variable, run tests — rather than one large rewrite where a mistake could be hiding anywhere.
4. Preserve the existing public API/interface unless changing it was explicitly requested — a refactor that silently changes a function's signature breaks every caller.
5. Run the full test suite after each meaningful step, not just once at the very end.
6. If mid-refactor you find a genuine bug in the existing behavior, don't silently fix it as part of the refactor — flag it and handle it as a separate, explicit change so the refactor's diff stays reviewable as "no behavior change."
