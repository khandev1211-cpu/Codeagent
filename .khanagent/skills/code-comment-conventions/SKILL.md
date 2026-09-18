---
name: code-comment-conventions
description: Write useful code comments, and know when not to. Use when adding comments to non-obvious code, distinct from docstring-conventions which covers formal API documentation.
allowed-tools: read_file, write_file, edit_file
---

# Code Comment Conventions

- Comment *why*, not *what* — the code already says what it does; a comment repeating that in English adds noise. A comment explaining why a seemingly-odd approach was chosen (a workaround for a specific bug, a non-obvious business rule) adds real information.
- If code needs a comment to explain what it does, first consider whether renaming a variable/function or restructuring would make the comment unnecessary — a good name is a comment that can't go stale.
- Comments go stale — when editing code with an existing comment, check whether the comment is still accurate, not just leave it untouched by habit.
- Flag genuinely risky or non-obvious code explicitly (`// NOTE:`, `// WARNING:` or the project's existing convention) rather than leaving a landmine for the next person with no signal at all.
- Don't leave commented-out code as a comment — if it's worth keeping, it's in version control history already; commented-out code in the source is just clutter and a question mark for the next reader ("is this safe to delete?").
- Match the project's existing comment density and style — a codebase that's sparse with comments and one that's heavily annotated both reflect a deliberate convention; don't unilaterally shift the norm in a single file.
