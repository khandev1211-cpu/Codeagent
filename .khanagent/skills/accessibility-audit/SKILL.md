---
name: accessibility-audit
description: Review UI code for accessibility issues. Use when writing new UI components or asked to check/improve accessibility.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Accessibility Audit

- Every interactive element must be reachable and operable via keyboard alone — tab order should follow visual/logical order, and nothing interactive should be a `<div onClick>` with no keyboard handler and no semantic role.
- Images need meaningful `alt` text (or an explicitly empty `alt=""` for genuinely decorative images) — not the filename, not "image."
- Form inputs need an associated, visible label (`<label for>` or `aria-label`), not just a placeholder — placeholder text disappears on input and isn't a substitute for a label.
- Color contrast meets WCAG AA at minimum for text — check actual contrast ratios, not just "does it look readable to me."
- Don't convey information by color alone (a red border as the only error indicator) — pair it with text, an icon, or another non-color signal.
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`) over generic `<div>`s with ARIA roles bolted on — semantic HTML gets correct behavior for free that ARIA-on-a-div has to manually replicate.
