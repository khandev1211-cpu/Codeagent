---
name: docstring-conventions
description: Write or review docstrings/doc comments for functions and modules. Use when documenting code, matching the project's existing doc-comment convention.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Docstring Conventions

- Match the project's existing docstring format and tooling (JSDoc, Python docstrings — Google/NumPy/reST style, Rustdoc, Godoc) rather than introducing a different convention for new code.
- Document *why* and any non-obvious behavior/contract, not a restatement of the code — a docstring saying "adds a to b" on a function called `add(a, b)` adds nothing a reader didn't already know from the name.
- Document what the code doesn't make obvious: side effects, exceptions/errors that can be thrown and when, whether a parameter can be null/None, units for numeric parameters, thread-safety if relevant.
- Keep docstrings in sync with the actual signature — a docstring listing a parameter that no longer exists, or missing one that was added, is actively misleading, worse than no docstring.
- Public/exported API surface deserves more complete documentation than a small private helper only used in one place.
- Include a usage example in the docstring for anything with a non-obvious calling convention, if the project's tooling supports rendering it.
