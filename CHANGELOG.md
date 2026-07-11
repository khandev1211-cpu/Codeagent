# Changelog

All notable changes to this project are documented here (Keep a Changelog format).

## [Unreleased]

## [0.1.0] - 2026-07-11

### Added
- Initial implementation of the full architecture described in `docs/`: CLI/REPL, Agent Core loop, Provider Layer (Anthropic + OpenRouter adapters), 6 core tools (`read_file`, `write_file`, `edit_file`, `list_dir`, `search_code`, `run_bash`), Safety Layer with `--yolo` bypass and audit logging, Session Store with resumable sessions and undo, layered Configuration system.
- OpenRouter adapter providing a path to free-tier models, alongside Anthropic as the default provider.
- Test suite (vitest) covering tools, config layering, safety confirmation gate, and the orchestrator loop against a fake provider.
