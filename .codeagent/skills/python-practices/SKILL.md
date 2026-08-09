---
name: python-practices
description: Write idiomatic, modern Python. Use when writing or reviewing Python code, or when the user asks for "pythonic" code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Python Practices

- Type hints on function signatures for anything non-trivial (`def f(x: int) -> str:`), even if the project isn't fully typed elsewhere yet — don't let inconsistency be an excuse to skip them on new code.
- f-strings over `.format()` or `%` formatting.
- `pathlib.Path` over `os.path` string manipulation for new code.
- Context managers (`with open(...) as f:`) for anything with a resource to release — files, locks, connections.
- List/dict/set comprehensions for simple transforms; a plain loop once the comprehension needs a comment to explain itself.
- Exceptions: catch specific exception types, never a bare `except:`. Don't swallow an exception silently without at least a comment explaining why it's safe to ignore.
- If the project has a `pyproject.toml`/`setup.cfg` with a configured linter (ruff, flake8, black), run it after edits (`run_bash`) rather than hand-formatting to match.
- Check for an existing virtual environment convention (`venv/`, `.venv/`, poetry, pipenv) before assuming `pip install` is the right way to add a dependency.
