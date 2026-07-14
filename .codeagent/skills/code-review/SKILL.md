---
name: code-review
description: Review a diff or set of recent changes for common issues before considering a task finished. Use this after making a non-trivial set of edits, or when the user explicitly asks for a review.
allowed-tools: read_file, search_code, run_bash
---

# Code Review Skill

Before declaring a coding task done, review what actually changed:

1. Get the real diff — `git diff` (or `git diff --staged`) — don't rely on your own memory of what you edited; re-read the actual result.
2. Check for these, in order of how often they actually matter:
   - **Does it do what was asked?** Re-read the original request against the diff, not against your plan for the diff.
   - **Broken references** — a renamed function/variable that's still called by its old name somewhere else, an import that no longer resolves.
   - **Error handling removed or weakened** — did a `try/catch` or a validation check get dropped in the process of making an edit?
   - **Tests** — if the project has a test suite (check for a `test/` directory or a `test`/`vitest`/`jest` script in `package.json`), did this change need a new or updated test? Don't add tests reflexively for trivial changes, but don't skip them for real behavior changes either.
   - **Leftover debug code** — stray `console.log`/`print` statements, commented-out old code, TODO markers that were meant to be temporary.
   - **Consistency with existing conventions** — does the new code match the surrounding file's style (naming, error handling patterns, whether it's the kind of codebase that uses early returns vs. nested conditionals), rather than introducing a new pattern for no reason?
3. If you find something worth flagging, say so directly and concretely — cite the file and what's wrong, don't just vaguely note "looks mostly good." A review that finds nothing is only useful if it was actually looked for.
4. This is a self-review pass on your own recent work, not a formal PR review process — keep it proportional to the size of the change; a one-line fix doesn't need the full checklist narrated back to the user.
