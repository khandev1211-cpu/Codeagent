---
name: csv-json-data-processing
description: Parse, transform, or generate CSV/JSON data correctly, including edge cases. Use when writing data import/export or transformation code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# CSV/JSON Data Processing

- Use a real parser library, never hand-rolled string splitting on commas/newlines for CSV — quoted fields containing commas, embedded newlines, and escaped quotes will break naive parsing in ways that look fine on simple test data.
- Validate structure before processing content — confirm expected columns/fields exist rather than assuming column N is always what you expect; a reordered or added column silently corrupts positional access.
- Handle encoding explicitly (UTF-8 vs. a legacy encoding, BOM presence) — a file that looks fine in one editor can have an encoding mismatch that corrupts non-ASCII characters on parse.
- Decide and document how missing/null/empty values are handled — an empty CSV cell, a JSON `null`, and a missing key are three different things that are easy to conflate.
- For large files, prefer streaming parsing over loading the whole file into memory when the file size could be unbounded — see the large-file-handling skill.
- When generating output, escape correctly (quote fields containing the delimiter, escape special JSON characters) — don't hand-build CSV/JSON strings via concatenation.
