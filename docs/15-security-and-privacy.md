# 15 — Security & Privacy

## API key handling

- Sourced only from an environment variable (name configurable, default `ANTHROPIC_API_KEY`, doc 09) — never written into a config file, never hardcoded, never committed.
- Read into memory only inside the Provider Layer's adapter (doc 06) — no other module holds a reference to it.
- **Never logged, at any log level.** The logger (`src/utils/logger.js`) applies an explicit redaction pattern matching known key formats as defense in depth, in addition to the discipline of simply never passing the key value into a log call in the first place.
- Never included in session persistence (doc 08) — session files store conversation and tool results, never request headers or credentials.

## Sandboxing and boundaries for `run_bash`

- Default working directory is the project root; the model can request a different `cwd`, but that request still goes through the normal destructive-call confirmation (doc 07) rather than being a privileged, unconfirmed path.
- Command timeout (doc 05) prevents an indefinitely hanging process from stalling the session or being used as a resource-exhaustion vector.
- No implicit `sudo`/elevated execution — if a command genuinely needs elevated privileges, that's the user's explicit responsibility to grant, not something the tool escalates to on its own.
- v1 does not include OS-level sandboxing (containers, chroot, etc.) beyond the working-directory default and confirmation gate — this is worth flagging honestly as a real limitation, not something to imply is fully contained. Users running with `--yolo` in particular should understand `run_bash` has the same access their own shell would have.

## Path traversal protection for file tools

- `write_file` / `edit_file` refuse to write outside the resolved project root unless `allowedWritePaths` (doc 09) is explicitly widened in project config.
- `read_file` has a size cap and truncates rather than attempting to read arbitrarily large or unexpected files blindly.
- These boundaries hold under `--yolo` as well — `--yolo` bypasses the human confirmation prompt (doc 07), not the structural path checks.

## Telemetry and privacy stance

- **No telemetry by default.** This tool reads and writes a user's own code and runs commands with their own credentials — the default posture should be that nothing about usage, project contents, or session data leaves the user's machine except the API calls to the configured LLM provider that the user explicitly set up.
- If telemetry is ever added (e.g. anonymous crash reporting), it must be opt-in, clearly documented in the README and this doc, and never include file contents, command output, or API keys — only high-level, non-identifying operational data (e.g. "a provider call failed with a timeout"), and this document should be updated at the same time the feature is, not after.
- Session files (doc 08) and Diff Tracker records (doc 08) live entirely on the user's local filesystem under their home directory — this project does not run a backend service that receives or stores this data (doc 01's non-goals).

## Supply chain

- Dependencies reviewed on a regular cadence, not just reactively (doc 14) — given this tool's trust surface (shell execution, file writes), a compromised dependency has a more consequential blast radius than in a typical utility package.
- `package.json`'s `"files"` allowlist (doc 03) plus `npm pack --dry-run` review before every publish (doc 13) prevents accidentally shipping local secrets, test fixtures, or session data to the npm registry.

## Responsible disclosure

A `SECURITY.md` should specify a private reporting channel (not a public GitHub issue) for anything that could let a project's contents, a user's API key, or arbitrary command execution be triggered outside the normal confirmed-tool-call path described in doc 07 — e.g. a prompt-injection style issue where content read from a file could manipulate the model into bypassing intended safety flow. This class of issue is specifically worth calling out because it's somewhat unique to agentic tools: the "input" isn't just what the user types, it's also everything `read_file`/`search_code`/`run_bash` bring back into context, and that returned content is something an attacker could potentially control (e.g. a malicious string embedded in a file the agent is asked to read).
