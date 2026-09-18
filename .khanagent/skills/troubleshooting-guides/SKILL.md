---
name: troubleshooting-guides
description: Write a troubleshooting guide for a common problem or error. Use when documenting a known issue and its fix, or asked to create troubleshooting documentation.
allowed-tools: read_file, write_file, edit_file
---

# Troubleshooting Guides

1. Lead with the exact symptom a reader would search for — the literal error message, or a precise description of the observed behavior — as a heading, so it's findable.
2. Explain the actual root cause briefly, not just "do this to fix it" — understanding why helps a reader recognize related problems later.
3. Give concrete, copy-pasteable steps to resolve it, in order, not vague guidance like "check your configuration."
4. Cover the realistic variations of the problem if there's more than one common cause for the same symptom, rather than assuming there's only one.
5. Include how to confirm the fix worked — what the reader should see once it's actually resolved.
6. Keep it current — a troubleshooting entry for an error that no longer occurs in the current version (because the underlying bug was fixed) should be removed or marked as historical, not left implying the problem still exists.
