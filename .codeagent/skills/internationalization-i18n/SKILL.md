---
name: internationalization-i18n
description: Add or review internationalization (i18n) support so an app works correctly across languages and locales. Use when adding translatable strings or reviewing i18n readiness.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Internationalization (i18n)

- Never concatenate translated string fragments to build a sentence — word order and grammar differ across languages, and concatenation breaks in ways that aren't visible in the source (English) language; use a proper interpolation/placeholder mechanism in the translation string itself.
- Externalize all user-facing strings into the project's translation files/mechanism, not hardcoded inline — even for a "temporary" or "just one string" case, since these tend to accumulate.
- Handle pluralization properly using the i18n library's plural rules, not a naive `count === 1 ? "item" : "items"` — many languages have more than two plural forms, and English's simple singular/plural rule doesn't generalize.
- Design layout to tolerate text expansion — translated text is often 30-50% longer than the English source; a UI that only works with English-length strings will visibly break in other locales.
- Format dates, numbers, and currency using locale-aware formatting (the platform's `Intl` API or equivalent), not hardcoded formats — date format order (MM/DD vs DD/MM) and decimal/thousands separators both vary by locale.
- Check the project's existing i18n library/convention before introducing a new translation mechanism for new strings.
