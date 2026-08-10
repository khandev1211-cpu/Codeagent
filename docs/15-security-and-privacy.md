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
- **Filesystem write confinement (`src/safety/sandbox.js`):** on Linux, commands run inside a `bubblewrap` sandbox with the whole filesystem mounted read-only except the project root and any configured `allowedWritePaths` (doc 09) — the same allowlist `write_file`/`edit_file`'s path guard already uses, so there's one definition of "what's writable," not two that could drift apart. On macOS, an equivalent `sandbox-exec` profile does the same thing (allow everything, deny writes outside the allowlist). This is `config.sandboxMode: "auto"` by default; `"off"` restores pre-sandboxing behavior.
- **Reads are deliberately unrestricted** inside the sandbox — a command can still read `~/.ssh`, `/etc`, or anything else the OS user could read outside the sandbox. Confining reads as well would break routine, legitimate commands (reading system libraries, package caches, config files elsewhere on disk) far more often than it would meaningfully improve security, given the model's tool outputs (including `run_bash`'s stdout) are already visible to whatever LLM provider is configured — a determined script can `cat` a secret and have the agent (not the sandbox) act on it regardless of read confinement. The boundary that matters most for blast radius is *write* access, which is why that's what's actually confined.
- **When no sandbox is available** (e.g. Windows, or Linux without `bubblewrap` installed), `run_bash` falls back to fully unconfined execution — and logs a warning once per process rather than silently degrading, so this isn't a surprise discovered only by reading source. Users running with `--yolo` on an unsandboxed platform in particular should understand `run_bash` has the same access their own shell would have.
- **No network isolation.** Sandboxing here is deliberately scoped to filesystem writes, not network access — cutting network would break `npm install`, `git push`, `curl`, and other commands that are routine, legitimate parts of a coding session. A command can still make outbound network calls from inside the sandbox.
- **Timeout + sandbox interaction:** on Linux, the sandboxed process runs in a private PID namespace (`bwrap --unshare-pid`) specifically so a timeout kill tears down the whole process tree rather than orphaning the sandboxed child — `SIGKILL` alone can't be relayed by `bwrap` (it can't be caught), so the timeout handler sends `SIGTERM` first and falls back to `SIGKILL` after a short grace period if the process is still alive.
- Still not included: syscall filtering (seccomp), resource limits (memory/CPU caps), or a `"strict"` mode that refuses to run without a sandbox. These are open items, not silently deferred — see PLAN.md.

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
