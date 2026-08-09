---
name: pr-description
description: Write a clear pull request description. Use when asked to write, draft, or update a PR description or title.
allowed-tools: read_file, run_bash
---

# PR Description

1. Look at the actual diff (`git diff main...HEAD` or equivalent, `run_bash`) before writing anything — don't describe the PR from memory of the conversation.
2. Lead with *what* and *why*, in that order — a reviewer should understand the change's purpose within the first sentence, before any implementation detail.
3. Structure: a short summary, then "What changed" (concrete, scannable — a list if there are multiple distinct changes), then "How to test" if it's not obvious from the code, then anything the reviewer should pay special attention to (a risky migration, a behavior change that isn't backward compatible).
4. Link the originating issue/ticket if one exists and is discoverable (check for an issue number in the branch name or recent commits) rather than leaving it unlinked.
5. If the diff touches multiple unrelated concerns, say so — don't write a description that papers over a PR that should probably have been split.
6. Don't pad it — a five-line PR doesn't need a "Testing" section restating that `npm test` was run if there's nothing specific to call out.
