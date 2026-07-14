<div align="center">
  <h1>🤖 Codeagent</h1>
  <p><strong>A terminal-native AI coding agent — describe a goal, watch it build.</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#usage">Usage</a> •
    <a href="#configuration">Configuration</a> •
    <a href="#documentation">Documentation</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <p>
    <img src="https://github.com/khandev1211-cpu/Codeagent/actions/workflows/ci.yml/badge.svg" alt="CI">
    <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node >=18">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License MIT">
    <img src="https://img.shields.io/badge/ESM-module-ffd700" alt="ESM Module">
  </p>
</div>

---

**codeagent** is a terminal-native AI coding agent, distributed as an npm package. Describe a goal in plain language — `codeagent` reads your project, plans, edits files, runs commands, and iterates until the task is done, asking for confirmation before anything destructive.

Unlike chat-based coding assistants that only print code blocks for you to manually copy, codeagent **acts directly** on your codebase: reading, writing, editing files, searching across your project, and executing shell commands — all driven by an LLM that decides which tools to call and when.

The project's direction is a self-hosted, provider-agnostic agent with the same shape as Claude Code: an agent loop, a growing tool set, and — on the roadmap — a **Skills** system and a **Plugin** system for extending it without touching the core. See [Roadmap](#roadmap) below for what's shipped versus what's planned.

---

## Features

| Capability | Description |
|---|---|
| 🧠 **Agentic, not just chat** | Calls tools directly (read/write/edit files, search code, run shell commands) instead of printing diffs for you to paste. |
| 🛡️ **Safe by default** | Every destructive action requires confirmation unless you explicitly pass `--yolo`. |
| 🔄 **Resumable sessions** | Kill the process and pick up exactly where you left off — no context lost. |
| ↩️ **Undo built in** | Revert the agent's most recent file changes without touching git. |
| 🔌 **Six providers today** | Anthropic, OpenRouter, Mistral, Groq, Cerebras, and Ollama — switch with `--provider` and `--model`. |
| 🧙 **Guided setup** | `codeagent setup` walks through provider, API key, and model selection. |
| 📜 **Scriptable** | One-shot mode with proper exit codes — works in CI as well as interactively. |
| 🧩 **Extensible by design** | Add new tools, providers, or config options without touching the core loop. |
| ✅ **Skills** | Discoverable `SKILL.md` capabilities, read on demand — see Roadmap. Plugins still planned. |

---

## Roadmap

Where codeagent is headed, and honestly, what's real today versus what's still design/in-progress. A full feature-by-feature audit against current Claude Code lives in [`docs/16`](./docs/16-claude-code-parity-audit.md); day-to-day phase planning lives in `PLAN.md` (not part of the published package).

| Area | Status | Notes |
|---|---|---|
| Core agent loop, 6 tools, safety/undo/sessions | ✅ Shipped | `docs/02`–`docs/08`. |
| Six provider adapters | ✅ Shipped | `docs/06`. Switch with `codeagent use <provider>`, or override per-run with `--provider`/`--model`. |
| Setup wizard, persisted config, first-run auto-detection | ✅ Shipped | `codeagent setup` remembers your choices in `~/.codeagentrc` and auto-runs on a fresh install. `codeagent providers` / `codeagent use` manage multiple configured providers; history carries over across a switch — see `docs/18`. |
| API key in OS keychain | ✅ Shipped | Read *and* write now — `codeagent setup` can save a key to the keychain and it's actually read back at boot (`docs/18`). Also fixed a real shell-injection risk in how keys were passed to `security`/`pass`/`cmdkey`. |
| Admin system prompt | ✅ Shipped (v1) | `codeagent system-prompt set "<text>"` — global, priority-layered over project context, doesn't touch the Safety Layer or Hooks (`docs/18`). |
| **Hooks** (lifecycle events: pre/post tool use, session start/end) | ✅ Shipped (v1) | Shell-command hooks only; `PreToolUse` can block, `PostToolUse` can add context. Project-scoped (`.codeagent/hooks.json`) only — see `docs/17` and `codeagent hooks`. |
| **Skills** (discoverable `SKILL.md` folders, progressive disclosure) | ✅ Shipped (v1) | Project-scoped (`.codeagent/skills/`) only for now. Two real examples ship with the repo. `allowed-tools` is parsed but not yet enforced — waiting on Permission Rules below. See `docs/19` and `codeagent skills`. |
| Fine-grained permission rules & Plan Mode | 🚧 Planned | Evolves the existing confirm/`--yolo` safety layer rather than replacing it. |
| **Subagents** | 🚧 Planned | Touches `orchestrator.js` directly, so per `docs/11` this needs a design pass, not a routine PR. Also reverses `docs/01`'s current "not a multi-agent framework" non-goal — that doc will be updated when this ships. |
| **MCP client** (connect external tool servers) | 🚧 Planned | Separate from the LLM provider adapters above — this is a new *tool* source, not a new provider. |
| **Plugins** (bundle Skills+Subagents+Hooks+MCP, install from GitHub/npm/local path) | 🚧 Planned | Deliberately last — in real Claude Code a plugin is a packaging format over the four items above, so building it first would ship an empty container. |
| Interactive config manager, usage/cost tracking | 🚧 Planned | Lower priority than the above; see `PLAN.md` Phase 9. |

Enterprise/hosted infrastructure (Bedrock/Vertex/Foundry routing, gateways, admin console, Slack/VS Code/JetBrains first-party extensions, hosted cloud execution, agent teams, remote control, computer use) is an explicit non-goal for this project — see `docs/16` for the reasoning.

---

## Quick Start

### Prerequisites

- **Node.js 18+** — required for native `fetch` and ESM support.
- **Anthropic API key** — set as the `ANTHROPIC_API_KEY` environment variable.

### Install

```bash
npm install -g codeagent
```

Or run without installing:

```bash
npx codeagent
```

### Setup

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

> **Security note:** Your API key is never stored in config files, logs, or session data. It is read from the environment variable at runtime and used only in the provider layer's HTTP requests.

### Your first session

```bash
cd your-project
codeagent
```

That starts an interactive REPL in your current directory. Describe what you want:

```
> Add input validation to the signup form and write a test for it
```

The agent will:
1. Read the relevant files to understand your codebase.
2. Show you a diff before writing anything.
3. Wait for your confirmation before each destructive action.
4. Iterate until the task is complete.

---

## Usage

### Commands

```
codeagent                        Start interactive session in current directory
codeagent "do X"                 One-shot: run a single request, print result, exit
codeagent --resume <id>          Resume a specific saved session
codeagent --resume last          Resume the most recent session for this project
codeagent --yolo                 Skip destructive-action confirmations for this run
codeagent --model <name>         Override the configured model for this run
codeagent --provider <name>      Override the configured provider for this run
codeagent setup                  Interactive first-time setup wizard (provider, key, model)
codeagent models [provider]      List available models for a provider (--details for pricing/context)
codeagent mistral-models         List Mistral models live from your API key
codeagent undo                   Revert the most recent destructive change
codeagent undo <ref>             Revert a specific recorded change
codeagent sessions               List saved sessions for this project
codeagent config                 Print the fully resolved config (API key redacted)
codeagent hooks                  List hooks configured for this project (.codeagent/hooks.json)
codeagent skills                  List skills discovered in .codeagent/skills/
codeagent providers               List every configured provider, which is active, and its key source
codeagent use <provider> [model]  Switch the active provider/model (persists; history carries over)
codeagent system-prompt [show|set <text>|clear]   Manage your global admin system prompt
```

> **Setup wizard:** `codeagent setup` walks you through it once — provider, key, model — and remembers it in `~/.codeagentrc`. Run it again anytime to add another provider, switch your default, or reconfigure a key; on a completely fresh install, just running `codeagent` triggers it automatically before your first command.

### Interactive REPL

- **Streaming output** by default — text renders as it arrives from the provider.
- **Tool calls** are rendered distinctly from the model's own text (e.g., `→ Reading src/index.js`).
- **Destructive-action confirmations** show the actual diff, not just a description.
- **Errors** are rendered clearly and distinctly from normal output.

### One-shot mode

```bash
codeagent --yolo "run the migration"
```

Runs a single turn non-interactively and exits with:
- Exit code `0` on success.
- Non-zero exit code on failure (limit hit, unrecoverable error, or destructive action needing confirmation without a TTY).

This makes codeagent suitable for scripting and CI pipelines.

### Session management

```bash
codeagent sessions              # List all saved sessions
codeagent --resume last         # Resume the most recent session
codeagent --resume abc123       # Resume a specific session by ID
```

Sessions are persisted after every turn (not just on clean exit), so a killed process loses at most one in-flight turn.

### Undo

```bash
codeagent undo                  # Revert the most recent destructive change
codeagent undo abc123           # Revert a specific recorded change
```

The undo system tracks every destructive action with before/after content — it's a fast safety net, not a replacement for git.

---

## Architecture

codeagent is built on a clean, layered architecture where each component has exactly one responsibility:

```
┌─────────────────────────────────────────────┐
│                 CLI / REPL                    │
│        (arg parsing, terminal I/O)           │
└──────────────────────┬───────────────────────┘
                       │
                ┌──────▼────────┐
                │  Agent Core    │
                │ (orchestrator) │
                └───┬──────┬─────┘
                    │      │
        ┌───────────▼──┐ ┌─▼────────────┐
        │ Provider Layer│ │ Tool Registry │
        │   (LLM API)   │ │  (tool list)  │
        └───────────────┘ └──┬────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Individual Tools   │
                    │ (read, write, bash) │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Safety/Confirmation│
                    │       Layer         │
                    └─────────────────────┘

        ┌────────────────────────────────────┐
        │  Cross-cutting: Session Store,      │
        │  Config, Logger, Context Manager    │
        └────────────────────────────────────┘
```

| Layer | Responsibility |
|---|---|
| **CLI / REPL** | Argument parsing, terminal I/O, output rendering |
| **Agent Core** | The loop: send → tool_use → execute → tool_result → repeat |
| **Provider Layer** | Translating abstract "send messages, get response" into a specific API's wire format |
| **Tool Registry** | Holding the list of available tools and their JSON schemas |
| **Individual Tools** | Doing one file/shell operation each, returning a structured result |
| **Safety Layer** | Classifying and gating destructive actions |
| **Session Store** | Persisting conversation + file-change history to disk |
| **Config** | Resolving layered settings into one final config object |

### Data flow for a single turn

1. User types a request in the REPL.
2. Agent Core appends it to the session's message list.
3. Agent Core calls the Provider Layer with messages + tool schemas.
4. Provider Layer returns text or `tool_use` blocks.
5. For each `tool_use`: Agent Core looks up the tool, passes through the Safety Layer, then executes.
6. Tool result is appended; loop returns to step 3.
7. When the model returns plain text with no tool calls, the turn ends and the session is persisted.

---

## Configuration

Settings resolve in this order (highest precedence first):

```
CLI flags → Project config (.codeagent/config.json) → Global config (~/.codeagentrc) → Built-in defaults
```

You don't need any config file to get started — everything works out of the box once `ANTHROPIC_API_KEY` is set.

### Key configuration fields

| Field | Type | Default | Description |
|---|---|---|---|
| `provider` | `"anthropic" \| "openrouter" \| "mistral" \| "groq" \| "cerebras" \| "ollama"` | `"anthropic"` | LLM provider to use |
| `model` | `string` | `"claude-sonnet-4-6"` | Model name |
| `maxIterationsPerTurn` | `number` | `25` | Max tool-use iterations per user turn |
| `yolo` | `boolean` | `false` | Skip destructive-action confirmations |
| `allowedWritePaths` | `string[]` | `["."]` | Paths the agent is allowed to write to |
| `planningEnabled` | `boolean` | `false` | Enable explicit task decomposition |
| `ollamaBaseUrl` | `string` | `"http://localhost:11434"` | Only read by the `ollama` provider |

### Supported providers

`codeagent` ships six provider adapters, all behind the same `Provider` interface (doc 06) — switching between them is just `--provider <name>` (and usually `--model <name>` too), no code change.

| Provider | `provider` value | API key env var | Notes |
|---|---|---|---|
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | Default |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | Gateway to many models, including `:free`-tagged ones |
| Mistral | `mistral` | `MISTRAL_API_KEY` | [console.mistral.ai](https://console.mistral.ai) |
| Groq | `groq` | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) — very fast inference, free tier |
| Cerebras | `cerebras` | `CEREBRAS_API_KEY` | [cloud.cerebras.ai](https://cloud.cerebras.ai) — very fast inference, free tier |
| Ollama | `ollama` | none (local) | Runs fully offline against a local Ollama server; set `ollamaBaseUrl` to point elsewhere |

Example:

```bash
export GROQ_API_KEY="gsk_..."
codeagent --provider groq --model llama-3.3-70b-versatile
```

```bash
# No API key needed — talks to a local Ollama server
codeagent --provider ollama --model llama3.1
```

### API key

- Read from the environment variable named in `apiKeyEnvVar` (default `ANTHROPIC_API_KEY`).
- **Never** stored directly in a config file.
- If the env var isn't set, boot fails immediately with a clear instruction.

---

## Safety

Destructive actions (writing files, editing files, running shell commands) always show you exactly what's about to happen and wait for confirmation — this isn't configurable per-tool.

| Mechanism | Description |
|---|---|
| **Confirmation prompts** | Every destructive call shows the actual diff before proceeding |
| **`--yolo` flag** | Bypass confirmations for unattended/CI runs (explicit, per-invocation) |
| **Audit logging** | Every bypassed confirmation is still logged with tool, input, and timestamp |
| **Path traversal protection** | Tools refuse to write outside the project root unless explicitly configured |
| **Undo capability** | All file changes are recorded and revertible, even under `--yolo` |

If you want the agent to run unattended (e.g., in a script or CI), pass `--yolo` explicitly. Every bypassed confirmation is still logged, and file changes are still undoable even under `--yolo`.

---

## Tools

codeagent ships with six core tools that give the agent full control over your project:

| Tool | Destructive | Purpose |
|---|---|---|
| `read_file` | No | Read file contents for code analysis |
| `write_file` | Yes | Create or overwrite files |
| `edit_file` | Yes | Make targeted find-and-replace edits |
| `list_dir` | No | Explore project structure |
| `search_code` | No | Regex search across the codebase |
| `run_bash` | Yes | Execute shell commands |

Adding a new tool is an **additive** change — create one file in `src/tools/` and register it. No core files need to change.

---

## Documentation

Full architecture and design docs live in [`docs/`](./docs):

| Doc | Covers |
|---|---|
| [00 — Index](./docs/00-index.md) | Start here — map of the entire doc set |
| [01 — Overview](./docs/01-overview.md) | Vision, goals, target users, non-goals |
| [02 — System Architecture](./docs/02-system-architecture.md) | Module map, data flow, layer responsibilities |
| [03 — Package Structure](./docs/03-package-structure.md) | Folder layout, package.json, module boundaries |
| [04 — Agent Core & Loop](./docs/04-agent-core-and-loop.md) | The orchestrator loop, limits, error handling |
| [05 — Tools](./docs/05-tools.md) | Every tool's schema, contract, and behavior |
| [06 — Provider Layer](./docs/06-provider-layer.md) | LLM abstraction, Anthropic adapter, retry logic |
| [07 — Safety & Permissions](./docs/07-safety-and-permissions.md) | Destructive-op gating, confirmation flow, `--yolo` |
| [08 — Context & Session Management](./docs/08-context-and-session-management.md) | Context window handling, persistence, undo |
| [09 — Configuration](./docs/09-configuration.md) | Layered config system, schema, env vars |
| [10 — CLI & UX](./docs/10-cli-and-ux.md) | Commands, flags, REPL behavior, output formatting |
| [11 — Extensibility & Plugins](./docs/11-extensibility-and-plugins.md) | Adding tools/providers without touching core |
| [12 — Testing & QA](./docs/12-testing-and-quality-assurance.md) | Test strategy per module, CI gates |
| [13 — Deployment, Publishing & Versioning](./docs/13-deployment-publishing-and-versioning.md) | npm publish pipeline, semver, changelog |
| [14 — Support, Maintenance & Roadmap](./docs/14-support-maintenance-and-roadmap.md) | Issue triage, support channels, roadmap |
| [15 — Security & Privacy](./docs/15-security-and-privacy.md) | API key handling, sandboxing, telemetry stance |
| [16 — Claude Code Parity Audit](./docs/16-claude-code-parity-audit.md) | Feature-by-feature audit vs. current Claude Code; what's in scope, what isn't, and why |
| [17 — Hooks](./docs/17-hooks.md) | Lifecycle event system — PreToolUse/PostToolUse/SessionStart/SessionEnd |
| [18 — Provider Management & Admin Prompt](./docs/18-provider-management-and-admin-prompt.md) | Multi-provider config, persisted setup, shared history across providers, admin system prompt |
| [19 — Skills](./docs/19-skills.md) | `SKILL.md` discovery, progressive disclosure, `.codeagent/skills/` |

---

## Extensibility

codeagent is designed so that adding capabilities is **additive** — a new file plus a one-line registration — rather than requiring changes to the orchestrator, provider layer, or safety layer.

| Extension | What to do |
|---|---|
| **New tool** | Create `src/tools/myTool.js` matching the tool shape, add one line to `src/tools/index.js` |
| **New provider** | Create `src/providers/myProvider.js` implementing the `Provider` interface, add one `case` to the factory |
| **New config option** | Add the field to `ConfigSchema` in `src/config/schema.js` with a sensible default |

See [doc 11 — Extensibility & Plugins](./docs/11-extensibility-and-plugins.md) for the full guide.

---

## Contributing

We welcome contributions! Here's how to get started:

1. **Read the docs** — especially [doc 11 (Extensibility)](./docs/11-extensibility-and-plugins.md) and [doc 14 (Support & Maintenance)](./docs/14-support-maintenance-and-roadmap.md).
2. **Most contributions are additive** — new tools, new providers, new config options don't require touching the core loop.
3. **Tests are required** — every new tool/provider needs tests per the patterns in [doc 12](./docs/12-testing-and-quality-assurance.md).
4. **PRs touching `orchestrator.js`, `base.js`, or `policy.js`** need extra scrutiny — these are the core contracts.

```bash
# Setup
git clone https://github.com/khandev1211-cpu/Codeagent.git
cd codeagent
npm install

# Run tests
npm test

# Lint
npm run lint
```

---

## Security

Please report security issues **privately** rather than opening a public issue. See [doc 15 — Security & Privacy](./docs/15-security-and-privacy.md) for scope and reporting guidance, particularly around prompt-injection-style risks specific to agentic tools.

Key security guarantees:
- API keys are never logged, stored in config files, or committed.
- Path traversal is blocked by default.
- All destructive actions are gated behind confirmation.
- Session data is stored locally and never sent to any third-party service.

---

## License

[MIT](./LICENSE) © codeagent contributors

---

<div align="center">
  <sub>Built with ❤️ for developers who want an AI coding partner that actually does the work.</sub>
</div>