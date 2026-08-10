# External Plugin Installation Plan

## Goal
Enable `codeagent` users to install and manage external applications/tools (plugins) from the command line, mirroring Claude Code’s “install external system” experience. Provide a concrete example by supporting the **Scrapling** project (`https://github.com/D4Vinci/Scrapling`).

---

## User Review Required
> **[!IMPORTANT]** The plan introduces a new plugin architecture that runs external binaries, raising security and cross‑platform concerns. Please review the decisions below and confirm or adjust them before implementation proceeds.

1. **Installation Scope** – Plugins are installed **locally per user** under `~/.codeagent/plugins/` (Windows: `%USERPROFILE%\.codeagent\plugins`). System‑wide install is out of scope for the initial version.
2. **Execution Model** – Plugins run as **subprocesses** with a sandboxed environment (no network access unless explicitly allowed).
3. **Security Model** –
   - Plugins must be signed with a SHA‑256 checksum that the user can verify.
   - Installation prompts the user to confirm the source URL and checksum.
   - Optional `--trust` flag to skip the prompt for trusted sources.
4. **Plugin Manifest** – Each plugin provides a `codeagent-plugin.json` describing:
   - `name`, `version`, `description`
   - `entrypoint` (executable script or binary)
   - `requiredTools` (optional external binaries that must be present)
   - `environment` (optional env vars)
5. **CLI Integration** – New sub‑command:
   ```bash
   codeagent plugin install <git-url-or-path> [--version <tag|sha>] [--trust]
   ```
   Supports GitHub HTTPS URLs and local directory paths. Uses `git clone` (or `git archive` for a specific tag) under the hood, validates the manifest and checksum, then registers the plugin.
6. **Runtime Loading** – Extend `src/plugins/pluginManager.js` to:
   - Scan the plugins directory at startup.
   - Dynamically import the manifest and expose a registry (`PluginRegistry`) that other components can query.
   - Provide a `runPlugin(name, args)` API that spawns the entrypoint with the current environment.
7. **Example Plugin – Scrapling** – Proof‑of‑concept wrapper:
   - Clones `https://github.com/D4Vinci/Scrapling`.
   - Installs its Python dependencies in a virtual environment (`venv`) under the plugin folder.
   - Exposes a command `scrapling <url>` usable from codeagent via a new `webScrape` tool.

---

## Open Questions
> **[!WARNING]**
1. **Trust Model** – Should we require manual checksum verification for every install, or maintain a centralized “trusted‑plugins” list?
2. **Cross‑Platform Build** – Scrapling is a Python project. Do we rely on the user’s Python runtime or ship a Node.js wrapper?
3. **Dependency Isolation** – Do we give each plugin its own isolated environment (Python venv, npm `node_modules`)?
4. **Plugin Removal** – Add a `codeagent plugin uninstall <name>` command now, or defer?
5. **Version Pinning** – How to handle plugins that depend on external binaries (e.g., `ffmpeg`)?

Please answer these to finalize the design.

---

## Proposed Changes

| Component | Change Type | Files |
|-----------|-------------|-------|
| **Plugin Registry** | **[NEW]** | `src/plugins/pluginManager.js` – new `PluginRegistry` class (`loadAll()`, `register()`, `run(name, args)`) |
| **CLI Sub‑command** | **[NEW]** | `src/cli/pluginInstall.js` – implements `codeagent plugin install` |
| **CLI Entry Point** | **[MODIFY]** | `src/cli/index.js` – add `plugin` command dispatcher |
| **Plugin Manifest Schema** | **[NEW]** | `src/plugins/manifestSchema.js` – validation with `zod` |
| **Plugin Execution Wrapper** | **[NEW]** | `src/tools/runPlugin.js` – tool that calls `PluginRegistry.run` (exposed to subagents) |
| **Documentation** | **[NEW]** | `docs/30-plugins.md` – usage guide, security notes, Scrapling example |
| **Test Suite** | **[NEW]** | `test/plugins/pluginManager.test.js`, `test/cli/pluginInstall.test.js` |

### Example Plugin – Scrapling
| Component | Change Type | Files |
|-----------|-------------|-------|
| **Wrapper Script** | **[NEW]** | `src/plugins/scrapling/run.js` – activates the venv and forwards args to the Python entrypoint |
| **Manifest** | **[NEW]** | `src/plugins/scrapling/codeagent-plugin.json` (name: `scrapling`, version: `1.0.0`, entrypoint: `run.js`) |
| **Installation Logic** | **[MODIFY]** | `src/cli/pluginInstall.js` – after cloning, runs `python -m venv venv && venv\Scripts\pip install -r requirements.txt` (Windows) / `venv/bin/pip` (POSIX) |
| **Tests** | **[NEW]** | `test/plugins/scrapling.test.js` – mocks `git clone` and verifies manifest loading |

---

## Verification Plan
### Automated Tests
1. **Plugin Manager Unit Tests** – load a mock plugin directory, verify manifest parsing, and that `run` spawns the correct subprocess with environment variables.
2. **CLI Install Tests** – mock `git clone` and checksum verification, assert the plugin appears in the registry after install.
3. **Scrapling Integration Test** – simulate installing Scrapling, run `codeagent plugin run scrapling <url>`, check that the subprocess returns expected output (mocked Python script).
4. **Security Tests** – ensure a plugin without a valid manifest is rejected and checksum mismatches abort installation.

### Manual Verification
1. Run:
   ```bash
   codeagent plugin install https://github.com/D4Vinci/Scrapling --trust
   ```
   Verify the plugin folder is created under `~/.codeagent/plugins/scrapling`, the Python venv is set up, and `codeagent plugin run scrapling https://example.com` works.
2. Check that the generated `~/.codeagent/plugins/scrapling` directory contains `codeagent-plugin.json`, `run.js`, and the `venv`.
3. Test error paths:
   - Install from an invalid URL → graceful error.
   - Install without `--trust` → prompt appears for confirmation.
4. Run the full test suite (`npm test`) to confirm existing functionality remains intact.

### Acceptance Criteria
- All existing tests **pass** (0 failures) after changes.
- New plugin‑related tests **pass**.
- `codeagent plugin install` works on both Windows and POSIX systems.
- Documentation updates build without lint errors.

---

**Next Step:** Please review the open questions above and provide your decisions. Once confirmed, I will begin implementing the changes in incremental commits.

---
