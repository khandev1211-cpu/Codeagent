# codeagent

A terminal-native AI coding agent, distributed as an npm package. Describe a goal in plain language — `codeagent` reads your project, plans, edits files, runs commands, and iterates until the task is done, asking for confirmation before anything destructive.

## Features

- **Agentic, not just chat** — calls tools directly (read/write/edit files, search code, run shell commands) instead of printing diffs for you to paste.
- **Safe by default** — every destructive action requires confirmation unless you explicitly pass `--yolo`.
- **Resumable sessions** — kill the process and pick up exactly where you left off.
- **Undo built in** — revert the agent's most recent file changes without touching git.
- **Provider-agnostic core** — Anthropic is the default, but the agent loop itself isn't hardcoded to one API.
- **Scriptable** — one-shot mode with proper exit codes, works in CI as well as interactively.

## Install

```bash
npm install -g codeagent
```

Or run without installing:

```bash
npx codeagent
```

Requires Node.js 18+.

## Setup

Set your Anthropic API key as an environment variable:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

## Quick start

```bash
cd your-project
codeagent
```

That starts an interactive session in your current directory. Describe what you want:

```
> Add input validation to the signup form and write a test for it
```

The agent will read the relevant files, show you a diff before writing anything, and wait for your confirmation.

## Usage

```
codeagent                        # start interactive session in current directory
codeagent "do X"                 # one-shot: run a single request, print result, exit
codeagent --resume <id>          # resume a specific saved session
codeagent --resume last          # resume the most recent session for this project
codeagent --yolo                 # skip destructive-action confirmations for this run
codeagent --model <name>         # override the configured model for this run
codeagent --provider <name>      # override the configured provider for this run
codeagent undo                   # revert the most recent destructive change
codeagent undo <ref>              # revert a specific recorded change
codeagent sessions                # list saved sessions for this project
codeagent config                 # print the fully resolved config (API key redacted)
```

## Configuration

Settings resolve in this order (highest precedence first): CLI flags → project config (`.codeagent/config.json`) → global config (`~/.codeagentrc`) → built-in defaults. You don't need any config file to get started — everything works out of the box once `ANTHROPIC_API_KEY` is set.

Full schema and examples: [`docs/09-configuration.md`](./docs/09-configuration.md)

## Safety

Destructive actions (writing files, editing files, running shell commands) always show you exactly what's about to happen and wait for confirmation — this isn't configurable per-tool. If you want the agent to run unattended (e.g. in a script or CI), pass `--yolo` explicitly. Every bypassed confirmation is still logged, and file changes are still undoable even under `--yolo`.

Details: [`docs/07-safety-and-permissions.md`](./docs/07-safety-and-permissions.md) · [`docs/15-security-and-privacy.md`](./docs/15-security-and-privacy.md)

## Documentation

Full architecture and design docs live in [`docs/`](./docs):

| Doc | Covers |
|---|---|
| [00 — Index](./docs/00-index.md) | Start here |
| [01 — Overview](./docs/01-overview.md) | Vision, goals, non-goals |
| [02 — System Architecture](./docs/02-system-architecture.md) | Module map, data flow |
| [03 — Package Structure](./docs/03-package-structure.md) | Folder layout, package.json |
| [04 — Agent Core & Loop](./docs/04-agent-core-and-loop.md) | The orchestrator loop |
| [05 — Tools & Skills](./docs/05-tools-and-skills.md) | Every tool's contract |
| [06 — Provider Layer](./docs/06-provider-layer.md) | LLM abstraction |
| [07 — Safety & Permissions](./docs/07-safety-and-permissions.md) | Destructive-op gating |
| [08 — Context & Session Management](./docs/08-context-and-session-management.md) | Context handling, persistence, undo |
| [09 — Configuration](./docs/09-configuration.md) | Layered config system |
| [10 — CLI & UX](./docs/10-cli-and-ux.md) | Full command reference |
| [11 — Extensibility & Plugins](./docs/11-extensibility-and-plugins.md) | Adding tools/providers |
| [12 — Testing & QA](./docs/12-testing-and-quality-assurance.md) | Test strategy |
| [13 — Deployment & Publishing](./docs/13-deployment-publishing-and-versioning.md) | Release process |
| [14 — Support, Maintenance & Roadmap](./docs/14-support-maintenance-and-roadmap.md) | Issue triage, roadmap |
| [15 — Security & Privacy](./docs/15-security-and-privacy.md) | Key handling, sandboxing, telemetry stance |

## Contributing

Read [`docs/11-extensibility-and-plugins.md`](./docs/11-extensibility-and-plugins.md) first — most contributions (new tools, new providers, new config options) are additive and don't require touching the core loop. See [`docs/14-support-maintenance-and-roadmap.md`](./docs/14-support-maintenance-and-roadmap.md) for the full contribution and triage process.

## Security

Please report security issues privately rather than opening a public issue — see [`docs/15-security-and-privacy.md`](./docs/15-security-and-privacy.md) for scope and reporting guidance, particularly around prompt-injection-style risks specific to agentic tools.

## License

MIT
