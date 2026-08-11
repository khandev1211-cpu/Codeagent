# 03 — Package Structure

## Folder layout

```
codeagent/
├── bin/
│   └── cli.js                  # shebang entry, minimal — delegates to src/
├── src/
│   ├── cli/
│   │   ├── index.js            # arg parsing (commander), command routing
│   │   ├── repl.js             # interactive loop UI
│   │   └── render.js           # output formatting
│   ├── agent/
│   │   ├── orchestrator.js     # the agentic loop
│   │   ├── context.js          # context window management, truncation
│   │   ├── planner.js          # optional multi-step task decomposition
│   │   └── systemPrompt.js     # system prompt templates, project context injection
│   ├── providers/
│   │   ├── base.js             # Provider interface
│   │   ├── anthropic.js        # Anthropic API adapter (default)
│   │   └── index.js            # provider factory/selector
│   ├── tools/
│   │   ├── registry.js         # tool registration + JSON schema export
│   │   ├── readFile.js
│   │   ├── writeFile.js
│   │   ├── editFile.js
│   │   ├── listDir.js
│   │   ├── searchCode.js
│   │   ├── runBash.js
│   │   └── index.js
│   ├── safety/
│   │   ├── confirm.js          # interactive y/n prompts
│   │   ├── policy.js           # destructive-op classification
│   │   └── yolo.js             # bypass flag handling
│   ├── session/
│   │   ├── store.js            # persist/resume conversations
│   │   └── diffTracker.js      # track file changes for undo
│   ├── config/
│   │   ├── loader.js           # config resolution across all sources
│   │   └── schema.js           # config validation (zod)
│   └── utils/
│       ├── logger.js
│       └── errors.js
├── test/
│   └── ...                     # mirrors src/ structure, one suite per module
├── package.json
├── README.md
└── CHANGELOG.md
```

## package.json shape

```json
{
  "name": "codeagent",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "codeagent": "./bin/cli.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "files": [
    "bin",
    "src",
    "README.md",
    "CHANGELOG.md"
  ],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src test",
    "prepublishOnly": "npm run lint && npm test"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "eslint": "^9.0.0"
  }
}
```

Notes:
- `"type": "module"` — the whole package is ESM, matching the existing project's convention.
- `"engines"` pins a minimum Node version so `fetch` and other modern APIs are guaranteed available without a polyfill.
- `"files"` is a deliberate allowlist — this is what actually ships to npm, not what's in the repo. Combined with `.npmignore` as a belt-and-suspenders check, this is what prevents accidentally publishing `test/`, `.env`, or local session data (doc 13 covers the publish checklist in full).
- `"prepublishOnly"` gates every publish behind lint + test passing — no manual "did I remember to test this" step.

## Why `bin/cli.js` is thin

`bin/cli.js` should be close to:

```js
#!/usr/bin/env node
import { run } from "../src/cli/index.js";
run(process.argv);
```

Keeping literally everything else in `src/` means:
- The entrypoint is trivially testable (or trivial enough it doesn't need much testing).
- `src/cli/index.js` can be imported directly in tests without spawning a subprocess.
- Future packaging changes (e.g. adding a second `bin` alias) don't touch actual logic.

## Naming and module boundaries

Every top-level folder under `src/` corresponds to exactly one layer from doc 02's architecture table. This is intentional and should be preserved as the project grows — if a new concern doesn't fit cleanly into `cli/`, `agent/`, `providers/`, `tools/`, `safety/`, `session/`, `config/`, or `utils/`, that's a signal to add a new top-level folder rather than overloading an existing one (see doc 11 for the extension process).
