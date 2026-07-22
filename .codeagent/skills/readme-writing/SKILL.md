---
name: readme-writing
description: Write or improve a project's README. Use when creating a new README or asked to improve documentation for a project's entry point.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# README Writing

1. Lead with what the project actually does and why someone would use it, in one or two sentences — not a badge wall or a table of contents before any context.
2. Installation and quick-start need to actually work — check real commands against the real project (`run_bash`) rather than writing plausible-looking instructions from memory.
3. A minimal, complete usage example before anything else — someone deciding whether to use this needs to see it work before reading configuration options or architecture details.
4. Keep advanced/rarely-needed content (full config reference, architecture deep-dive, contribution guide) in linked separate docs rather than making the README itself enormous.
5. Keep it accurate as the project changes — a README describing a CLI flag that no longer exists, or missing one that was added, is worse than a shorter but correct one.
6. Check for an existing README structure/tone before rewriting wholesale — match what's there unless a full rewrite was explicitly requested.
