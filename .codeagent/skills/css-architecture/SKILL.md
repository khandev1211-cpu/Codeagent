---
name: css-architecture
description: Organize and write maintainable CSS/styling for a project. Use when adding new styles or reviewing styling approach.
allowed-tools: read_file, write_file, edit_file, search_code
---

# CSS Architecture

- Match the project's existing approach (CSS Modules, Tailwind utility classes, styled-components, plain BEM CSS) rather than mixing a second styling paradigm into a codebase that's already committed to one.
- Avoid deeply specific selectors and `!important` — both make future overrides progressively harder and are usually a sign of fighting the existing cascade rather than working with it.
- Prefer composition (small, reusable utility classes or components) over one-off styles duplicated across multiple places that will drift out of sync.
- Use CSS custom properties (variables) for values that repeat with meaning (brand colors, spacing scale) rather than hardcoding the same hex value/pixel number in many places.
- Keep component-specific styles scoped to that component (CSS Modules, scoped styled-components) rather than global styles that can leak and affect unrelated parts of the page.
- Check for an existing design-tokens/theme file before hardcoding a new color or spacing value that's close-but-not-quite one that already exists.
