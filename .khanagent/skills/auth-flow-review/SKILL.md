---
name: auth-flow-review
description: Review an authentication or authorization flow for correctness and common vulnerabilities. Use when implementing or reviewing login, session handling, or permission checks.
allowed-tools: read_file, search_code
---

# Auth Flow Review

- Authorization checks belong on the server for every protected action, not just hidden UI — a button being hidden in the frontend is not the same as the backend rejecting the request.
- Check for missing authorization on individual resources, not just endpoints — an endpoint that correctly requires login can still be missing "does this user actually own/have access to *this specific* resource ID" (a common IDOR — insecure direct object reference — bug).
- Passwords: hashed with a proper algorithm (bcrypt/argon2/scrypt), never stored plaintext or with a fast general-purpose hash like plain SHA-256.
- Session/token handling: tokens expire, can be revoked, and aren't exposed in URLs (which get logged) or client-readable storage for anything sensitive.
- Check for timing-safe comparison on anything security-sensitive being compared (tokens, password hashes) rather than a standard `==`/`===` that can leak information via timing.
- Rate-limit authentication endpoints (login, password reset) specifically — they're the most common brute-force target.
