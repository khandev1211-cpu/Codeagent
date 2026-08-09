---
name: large-file-handling
description: Process a large file (much bigger than comfortably fits in memory) correctly. Use when working with large datasets, log files, or bulk imports/exports.
allowed-tools: read_file, write_file, run_bash
---

# Large File Handling

- Stream, don't load the whole file into memory — use the language's streaming/iterator-based file APIs rather than a single `readFile`/`read()` call for anything whose size isn't bounded and known-small.
- Process in chunks/batches for anything that also needs a corresponding write (a transform pipeline) rather than accumulating the entire transformed result in memory before writing any of it out.
- For a large file to a database, use the database's bulk-load facility if one exists rather than inserting row by row in a loop, which is dramatically slower and often opens one transaction per row unintentionally.
- Handle partial/interrupted processing explicitly for anything long-running — know how to resume or detect a partially-processed file rather than assuming the process will always run to completion uninterrupted.
- Report progress for anything that takes more than a few seconds, so a caller/operator can tell it's working versus hung.
- Test against a realistically-sized file, not just a small sample — a script that works on a 10-row test file can still have an O(n²) bug invisible until real scale.
