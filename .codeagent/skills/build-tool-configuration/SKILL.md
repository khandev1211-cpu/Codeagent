---
name: build-tool-configuration
description: Configure or troubleshoot a build tool (Webpack, Vite, esbuild, Rollup, Make, Bazel). Use when setting up a new build pipeline or debugging build errors/performance.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Build Tool Configuration

- Understand what the current config actually does before changing it — read the resolved config output if the tool supports inspecting it (`run_bash`), rather than guessing from the config file alone, especially when there's a chain of presets/plugins.
- Keep build times reasonable by checking for genuinely necessary transforms vs. accumulated unnecessary ones (an unused plugin still processing every file, overly broad file-watching patterns).
- Separate development and production configuration explicitly (source maps, minification, hot-reload) rather than one config trying to serve both with runtime conditionals scattered throughout.
- For a build error, read the actual error message and the specific file/loader it references before guessing — build tool errors often point precisely at the problem (a missing loader for a file type, a resolution failure for a specific import) even when the message looks intimidating.
- Pin build tool and plugin versions deliberately — build tooling has historically had more breaking changes between versions than application code, and an unpinned build dependency can break CI unexpectedly.
- Check for an existing convention (a shared base config extended per-package in a monorepo) before writing a new standalone config from scratch.
