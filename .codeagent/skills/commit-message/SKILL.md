---
name: commit-message
description: Write a well-formatted git commit message following Conventional Commits style. Use this when the user asks to commit changes, write a commit message, or describe what a diff does for a commit.
allowed-tools: run_bash
---

# Commit Message Skill

When asked to write or make a commit:

1. Run `git diff --staged` (or `git diff` if nothing is staged yet) to see what actually changed — never guess at the diff from memory or from the conversation alone.
2. Use [Conventional Commits](https://www.conventionalcommits.org/) format:
   ```
   type(scope): short summary in imperative mood

   Optional longer body explaining *why*, not just what — the diff
   already shows what changed.
   ```
3. Common `type` values: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`. Pick the one that matches the *primary* purpose of the change; if a change is genuinely mixed (e.g. a fix that also adds tests), lead with the more significant type and mention the rest in the body.
4. Keep the summary line under ~72 characters. No trailing period on the summary line.
5. If the diff touches multiple unrelated concerns, say so explicitly rather than writing one commit message that tries to cover everything — suggest splitting into separate commits if that seems right, don't just paper over it.
6. Don't invent scope or motivation the diff doesn't support. If it's unclear why a change was made, ask, rather than fabricating a plausible-sounding rationale.
