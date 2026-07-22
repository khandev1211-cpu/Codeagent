---
name: removing-dead-code
description: Find and safely remove unused code — functions, exports, dependencies, files. Use when asked to clean up unused code, or as part of a broader refactor.
allowed-tools: read_file, search_code, run_bash, edit_file
---

# Removing Dead Code

1. Verify something is actually unused before removing it — search for every reference (`search_code`), not just an obvious one, including dynamic references (string-based lookups, reflection, config-driven dispatch) that a simple text search might miss.
2. Check for external usage if this is a published library or has a public API — code unused *within this repo* might still be part of a public contract other consumers depend on.
3. Remove in the right order: callers before the thing they call, or the whole chain together — leaving an unused private helper behind after removing its only caller is an easy thing to miss.
4. Check for a linter with unused-code detection already configured (`eslint no-unused-vars`, `go vet`, `cargo build` warnings) and run it (`run_bash`) rather than relying purely on manual search.
5. Remove the associated tests for removed code too — a test for a function that no longer exists either fails to compile or, worse, silently tests nothing.
6. If something looks unused but you're not fully confident (e.g. it might be an intentionally-kept public API surface), say so rather than deleting it silently.
