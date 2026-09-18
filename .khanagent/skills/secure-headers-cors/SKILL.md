---
name: secure-headers-cors
description: Configure security-relevant HTTP headers and CORS correctly. Use when setting up or reviewing a web server/API's header configuration.
allowed-tools: read_file, write_file, edit_file
---

# Secure Headers & CORS

- CORS: set `Access-Control-Allow-Origin` to an explicit allowlist of real origins, never a bare `*` combined with credentials — that combination is invalid per spec for a reason, and a bare `*` alone is often broader than intended.
- Set `Content-Security-Policy` deliberately rather than leaving it absent — even a basic policy meaningfully reduces XSS impact.
- `X-Content-Type-Options: nosniff` and `X-Frame-Options`/`frame-ancestors` (clickjacking protection) unless the app genuinely needs to be framed.
- `Strict-Transport-Security` if the site is HTTPS-only (it should be) — tells browsers to never downgrade to HTTP for this domain.
- Check the project's existing framework/middleware for security headers (helmet.js, django-security, etc.) before hand-rolling — these exist specifically to get sane defaults right, which are easy to get subtly wrong by hand.
- Don't disable a security header to fix a development-environment problem without a mechanism ensuring it stays enabled in production.
