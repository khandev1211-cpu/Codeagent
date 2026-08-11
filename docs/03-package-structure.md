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
│   │   ├── slashCommands.js    # in-REPL /commands (/help, /plan, /compact, /review, /test)
│   │   ├── render.js           # output formatting
│   │   ├── models.js           # model listing per provider
│   │   ├── mistralModels.js    # live Mistral model list from API key
│   │   ├── setup.js            # interactive setup wizard
│   │   └── tui/                # Ink-based rich TUI (status header, model switcher)
│   │       ├── index.js
│   │       └── App.js
│   ├── agent/
│   │   ├── orchestrator.js     # the agentic loop
│   │   ├── context.js          # context window management, truncation
│   │   ├── planner.js          # optional multi-step task decomposition
│   │   ├── memory.js           # CODEAGENT.md / CLAUDE.md + .codeagent/rules/*.md discovery
│   │   ├── subagent.js         # SubagentRunner — isolated child agents
│   │   ├── discoverSubagents.js # .codeagent/agents/*.md discovery + frontmatter parsing
│   │   ├── subagentRegistry.js # SubagentRegistry + wireSubagentsIndex
│   │   └── systemPrompt.js     # system prompt templates, project context injection
│   ├── providers/
│   │   ├── base.js             # Provider interface
│   │   ├── anthropic.js        # Anthropic API adapter (default)
│   │   ├── openrouter.js       # OpenRouter adapter
│   │   ├── mistral.js          # Mistral adapter
│   │   ├── groq.js             # Groq adapter
│   │   ├── cerebras.js         # Cerebras adapter
│   │   ├── ollama.js           # Ollama (local) adapter
│   │   ├── openAiCompatible.js # Shared OpenAI-compatible base
│   │   ├── modelRegistry.js    # per-provider model defaults
│   │   ├── resolveApiKey.js    # env-var → keychain key resolution
│   │   └── index.js            # provider factory/selector
│   ├── tools/
│   │   ├── registry.js         # tool registration + JSON schema export
│   │   ├── readFile.js
│   │   ├── writeFile.js
│   │   ├── editFile.js
│   │   ├── listDir.js
│   │   ├── searchCode.js
│   │   ├── runBash.js
│   │   ├── skillInfo.js        # skills description lookup (compact index mode)
│   │   ├── runSubagent.js      # delegate a task to a subagent
│   │   ├── webFetch.js         # fetch web content
│   │   ├── webSearch.js        # web search via DuckDuckGo
│   │   ├── pathGuard.js        # write-path confinement
│   │   ├── gitignore.js        # .gitignore-aware listing helpers
│   │   └── index.js
│   ├── mcp/
│   │   ├── mcpClient.js        # stdio MCP (Model Context Protocol) client
│   │   └── loader.js           # .codeagent/mcp.json discovery + tool conversion
│   ├── plugins/
│   │   ├── pluginManager.js    # plugin installation helper
│   │   └── pluginRegistry.js   # plugin discovery + manifest validation
│   ├── hooks/
│   │   ├── events.js           # HOOK_EVENTS constants
│   │   ├── registry.js         # hook execution engine
│   │   ├── matcher.js          # tool/event matcher
│   │   ├── runHook.js          # shell command invocation
│   │   ├── loadHooksConfig.js  # .codeagent/hooks.json parsing
│   │   ├── audit.js            # logHookBlock — persistent hook-block audit trail
│   │   └── index.js
│   ├── safety/
│   │   ├── confirm.js          # interactive y/n prompts
│   │   ├── policy.js           # destructive-op classification
│   │   ├── yolo.js             # bypass flag handling
│   │   ├── permissionRules.js  # fine-grained allow/deny rules
│   │   ├── planMode.js         # --plan read-only execution mode
│   │   ├── sandbox.js          # bubblewrap/sandbox-exec write confinement
│   │   └── glob.js             # pattern matching helpers
│   ├── session/
│   │   ├── store.js            # persist/resume conversations
│   │   └── diffTracker.js      # track file changes for undo
│   ├── skills/
│   │   ├── discover.js         # .codeagent/skills/<name>/SKILL.md discovery
│   │   ├── frontmatter.js      # YAML frontmatter parser
│   │   ├── registry.js         # SkillRegistry: list/has/get/describe
│   │   └── index.js            # wireSkillsIndex() — compact/full mode decision
│   ├── config/
│   │   ├── loader.js           # config resolution across all sources
│   │   └── schema.js           # config validation (zod)
│   └── utils/
│       ├── logger.js
│       ├── keychain.js         # OS keychain integration
│       └── errors.js
├── test/
│   └── ...                     # mirrors src/ structure, one suite per module
├── package.json
├── README.md
├── CHANGELOG.md
├── docs/
│   └── ...                     # 00–22 architecture/design docs
├── PLAN.md                     # phase-by-phase implementation plan
└── .codeagent/
    ├── agents/                 # subagent definitions (reviewer, fixer)
    ├── commands/               # custom slash command templates
    ├── skills/                 # SKILL.md folders
    └── plugins/                # installed plugins