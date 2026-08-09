---
name: reducing-complexity
description: Simplify an overly complex function, class, or module. Use when code is hard to follow, deeply nested, or the user asks to simplify something.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Reducing Complexity

1. Identify the actual source of complexity first — deep nesting, a function doing too many unrelated things, a conditional with too many branches, or genuinely inherent problem complexity that no restructuring will remove.
2. Guard clauses / early returns to flatten nesting, rather than deeply nested `if/else`.
3. Extract a well-named function for a distinct sub-responsibility, rather than leaving it inline with a comment explaining what that block does — the function name should make the comment unnecessary.
4. A long parameter list is often a sign of a missing abstraction (group related parameters into an object/struct) rather than something to just leave as-is.
5. Don't over-abstract in the other direction — introducing three layers of indirection to "simplify" a function that was 15 straightforward lines makes it harder to follow, not easier. Match the abstraction to the actual complexity.
6. After simplifying, re-run the tests — simplification that changes behavior isn't simplification, it's a bug.
