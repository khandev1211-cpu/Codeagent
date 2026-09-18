---
name: responsive-design
description: Build or review a UI that needs to work across screen sizes. Use when implementing a new layout/component or fixing a mobile-layout bug.
allowed-tools: read_file, write_file, edit_file
---

# Responsive Design

- Mobile-first: write the base styles for small screens, add complexity for larger ones via breakpoints, rather than the reverse — it's usually easier to add layout richness at larger sizes than to strip it away for small ones.
- Use relative units (`rem`, `%`, `fr`, `vw`/`vh` where appropriate) over fixed pixel values for anything that should scale, but don't avoid `px` entirely where a fixed size is genuinely correct (a 1px border).
- Test actual breakpoints the project's design system defines, not arbitrary ones — check for an existing Tailwind config, CSS custom properties, or a design-tokens file before inventing new breakpoint values.
- Touch targets need to be large enough for a finger, not just a mouse cursor (roughly 44x44px minimum) on anything interactive that might render on mobile.
- Avoid fixed-height containers for content of variable/unpredictable length — text that's fine in English can overflow in a longer-word language, or with user-generated content of unexpected length.
- Check horizontal scroll doesn't appear unintentionally at common breakpoints — a single element slightly too wide can break the whole page's layout on mobile.
