# Implementation Plan: Claude Code Parity Roadmap for Codeagent

Transform `codeagent` into a full-featured, extensible AI coding assistant matching Claude Code's agentic shape, extensibility, memory, and safety guarantees.

## User Review Required

> [!IMPORTANT]
> **Extensibility Blueprint**: Real Claude Code plugins act as containers for **Skills**, **Subagents**, **Hooks**, and **MCP Servers**. Therefore, Subagents and MCP Client support must be implemented before the Plugin packaging layer is finalized.

> [!NOTE]
> **Scope Boundaries**: Desktop UI, mobile app remote control, and cloud-hosted SaaS infrastructure are explicitly kept out of scope (Tier 3 non-goals), focusing 100% on terminal-native developer experience and feature parity.

## Open Questions

> [!IMPORTANT]
> **Subagent Concurrency**: Should initial Subagent execution run **synchronously** (blocking main agent until subagent completes) or **asynchronously in background**? We propose starting synchronous for predictable turn state before introducing background subagent tasks.

> [!TIP]
> **Default Memory File**: Should the auto-discovered project instruction file be named `CODEAGENT.md` (project-specific) or fall back to checking `CLAUDE.md` as well for multi-agent interoperability?

---

## Proposed Changes

The plan is organized into sequential phases following established project design guidelines (`docs/16-claude-code-parity-audit.md` & `PLAN.md`).

---

### Component 1: Project Memory (`CODEAGENT.md` & `.codeagent/rules/`)

Adds directory-layered, auto-discovered project memory and rules into the system prompt context.

#### [NEW] [memory.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/agent/memory.js)
- Implements `discoverProjectMemory(cwd)` searching for `CODEAGENT.md` and `.codeagent/rules/*.md`.
- Parses and formats instructions into system prompt context layers.

#### [MODIFY] [systemPrompt.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/agent/systemPrompt.js)
- Integrates project memory section right after base instructions and before workspace auto-context.

---

### Component 2: In-REPL Slash Commands

Adds interactive `/command` templates and control shortcuts within the interactive REPL.

#### [NEW] [slashCommands.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/cli/slashCommands.js)
- Registry and parser for built-in slash commands (`/review`, `/test`, `/compact`, `/plan`, `/help`, `/clear`).
- Loads project-scoped custom slash commands from `.codeagent/commands/`.

#### [MODIFY] [repl.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/cli/repl.js)
- Intercepts user input starting with `/`, resolving slash command templates before submitting to `Orchestrator.runTurn()`.

---

### Component 3: Subagents Framework (Phase 6)

Spawns named, isolated-context child agents for delegation (e.g., deep research, test execution, code review) without polluting main conversation history.

#### [NEW] [subagent.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/agent/subagent.js)
- `SubagentRunner` class managing isolated `Orchestrator` instances with restricted tool sets and custom subagent system prompts.
- Reads subagent definitions from `.codeagent/agents/<name>.md`.

#### [NEW] [runSubagent.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/tools/runSubagent.js)
- Tool implementation enabling the parent agent to invoke subagents explicitly (`run_subagent` tool).

---

### Component 4: MCP Client Support (Phase 7)

Connects external Model Context Protocol (MCP) servers to expose external tools (databases, GitHub, browser automation) dynamically.

#### [NEW] [mcpClient.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/mcp/mcpClient.js)
- Connects to MCP servers via stdio and HTTP/SSE transports.
- Translates MCP tool definitions into `codeagent` tool schemas.

#### [NEW] [loader.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/mcp/loader.js)
- Discovers and parses `.codeagent/mcp.json` server definitions.
- Registers dynamic tools into `ToolRegistry`.

---

### Component 5: Plugin Packaging & Distribution (Phase 8)

Bundles Skills + Subagents + Hooks + MCP configs into shareable plugin packages.

#### [NEW] [pluginRegistry.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/plugins/pluginRegistry.js)
- Validates plugin manifests (`codeagent-plugin.json`).
- Loads bundled skills, hooks, subagents, and MCP configurations.

#### [NEW] [pluginManager.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/plugins/pluginManager.js)
- CLI installer for local directories, Git repositories, or npm packages (`codeagent plugins install <target>`).

---

### Component 6: Web Tools & Security Sandboxing

#### [NEW] [webFetch.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/tools/webFetch.js) & [webSearch.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/tools/webSearch.js)
- Web content fetching and search integration tools with host permissions safety checks.

#### [MODIFY] [runBash.js](file:///c:/Users/CHAND%20COMPUTER/Desktop/codeagent/src/tools/runBash.js)
- Wraps command execution with process isolation options and optional command restriction guards.

---

## Verification Plan

### Automated Tests
- `npm test` - Run full unit and integration test suite across all sub-packages.
- `vitest test/agent/memory.test.js` - Verify `CODEAGENT.md` discovery and context building.
- `vitest test/cli/slashCommands.test.js` - Test slash command parsing and argument interpolation.
- `vitest test/agent/subagent.test.js` - Verify isolated history, tool restrictions, and return payloads.
- `vitest test/mcp/mcpClient.test.js` - Mock stdio MCP server handshake and tool registration.
- `vitest test/plugins/pluginRegistry.test.js` - Validate plugin manifest loading and resource registration.

### Manual Verification
1. Run `codeagent setup` and test interactive REPL with new slash commands (`/help`, `/plan`, `/compact`).
2. Add a test `.codeagent/skills/` or `CODEAGENT.md` to verify auto-discovery in system prompt.
3. Test `codeagent --plan` and permission rules with destructive commands.
