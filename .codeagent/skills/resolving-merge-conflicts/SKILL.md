---
name: resolving-merge-conflicts
description: Resolve git merge or rebase conflicts correctly. Use when a merge/rebase has left conflict markers in files, or the user asks for help resolving conflicts.
allowed-tools: read_file, edit_file, run_bash
---

# Resolving Merge Conflicts

1. Understand both sides before resolving — read the surrounding context of each conflict, not just the marked lines, and check `git log` on both branches for the conflicting hunk if the intent isn't obvious from the code alone.
2. The goal is the correct *combined* result, not picking one side wholesale by default — often both changes need to be kept, adapted to work together.
3. Resolve one file at a time, and re-read the whole resolved section afterward (not just the previously-conflicted lines) — a conflict resolution can leave code that's syntactically valid but logically broken (e.g. a variable renamed on one side but not the other, now referenced inconsistently).
4. After resolving, remove all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) — search for them explicitly before considering the file done; a leftover marker is either a syntax error or, worse, silently valid code that shouldn't be there.
5. Run the test suite after resolving (`run_bash`), not just a visual check — a conflict resolution that "looks right" can still break behavior a test would have caught.
6. If a conflict is genuinely ambiguous (both sides made a real, incompatible decision), say so rather than guessing — flag it for the user rather than silently picking one.
