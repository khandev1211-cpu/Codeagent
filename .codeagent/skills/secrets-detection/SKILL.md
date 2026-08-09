---
name: secrets-detection
description: Find and remediate hardcoded secrets (API keys, passwords, tokens) in code. Use when reviewing code for secrets, or after a secret is suspected to have been committed.
allowed-tools: read_file, search_code, run_bash
---

# Secrets Detection

1. Search for common secret patterns (`search_code`): API key-shaped strings, `password =`/`secret =`/`token =` assignments with a literal value, private key blocks (`-----BEGIN`), connection strings with embedded credentials.
2. A secret found in code is not fixed by just deleting the line — if it was ever committed, it's in git history and must be treated as compromised: rotate/revoke the actual credential, don't just remove it from the current file.
3. Replace hardcoded secrets with environment variable references or the project's existing secrets-management convention (a `.env` file that's gitignored, a secrets manager) rather than a different one-off mechanism.
4. Check that the replacement env var is actually documented (a `.env.example` with the variable name but no real value) so the project remains runnable by someone else.
5. If a secrets-scanning tool is already configured in CI, don't just fix the one instance found — check whether the scan is passing now and would have caught this, and flag it if not.
