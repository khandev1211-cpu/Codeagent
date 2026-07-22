---
name: javascript-typescript-practices
description: Write idiomatic modern JavaScript/TypeScript. Use when writing or reviewing JS/TS code, especially in a project you haven't seen the conventions of yet.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# JavaScript/TypeScript Practices

- Check `package.json` first: is this ESM (`"type": "module"`) or CommonJS? Match it — don't mix `require()` and `import` in the same project.
- `const` by default, `let` only when reassignment is real, never `var`.
- Prefer `async/await` over raw `.then()` chains for new code, unless the surrounding file is already consistently `.then()`-based.
- In TypeScript: avoid `any` — if the real type is genuinely unknown, `unknown` plus a narrowing check is almost always more honest than `any`.
- Destructure function parameters when there are more than 2-3, for readability and self-documenting call sites.
- Template literals over string concatenation.
- If there's an `.eslintrc`/`eslint.config.js`, run the linter after edits rather than guessing at the project's exact style rules.
- Check for a bundler/build config (`vite.config`, `webpack.config`, `tsconfig.json`) before assuming how imports resolve — path aliases are common and easy to miss.
