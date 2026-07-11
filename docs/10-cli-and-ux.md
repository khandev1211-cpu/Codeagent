# 10 — CLI & UX

## Command surface

```
codeagent                        # start interactive REPL in current directory
codeagent "do X"                 # one-shot: run a single request non-interactively, print result, exit
codeagent --resume <id>          # resume a specific saved session
codeagent --resume last          # resume the most recent session for this project
codeagent --yolo                 # bypass destructive-action confirmations for this run
codeagent --model <name>         # override configured model for this run
codeagent --provider <name>      # override configured provider for this run
codeagent undo                   # revert the most recent destructive change (doc 08)
codeagent undo <ref>              # revert a specific recorded change
codeagent sessions                # list saved sessions for this project
codeagent config                 # print the fully resolved config (doc 09), with API key redacted
```

Flags follow standard conventions (`--flag value` and `--flag=value` both work, via `commander`); no flag is required for basic usage — running bare `codeagent` should always work if a valid API key is available (doc 09).

## REPL behavior (`src/cli/repl.js`)

- Streaming output by default — text renders as it arrives from the provider rather than waiting for the full response (doc 06's `stream()` method is what powers this).
- Tool calls are rendered distinctly from the model's own text — e.g. a tool call shows as a clearly marked action line ("→ Reading `src/index.js`"), not interleaved indistinguishably with prose.
- Destructive-action confirmations (doc 07) render the actual diff, not just a description, so the user is confirming something they can actually read.
- Errors (tool failure, provider failure, limit hit) are rendered clearly and distinctly from normal output — not swallowed into a generic "something went wrong."

## One-shot mode

`codeagent "request"` runs a single turn (which may itself involve many internal tool-use iterations, per doc 04's loop) non-interactively and exits with:
- Exit code `0` on success.
- Non-zero exit code on failure (limit hit, unrecoverable error, or — critically — a destructive action that needed confirmation but no TTY was available to ask, unless `--yolo` was passed).

This matters specifically for scripting and CI use (doc 01's success criteria): a script invoking `codeagent --yolo "run the migration"` should behave like any other well-behaved CLI tool with predictable exit codes, not require a human at a prompt.

## Output formatting (`src/cli/render.js`)

- Color used for meaning (errors in one consistent color, tool-action lines in another, diffs with standard +/- coloring) — not decorative.
- No color codes emitted when output isn't a TTY (e.g. piped to a file or another program) — this is a standard CLI courtesy and also matters directly for one-shot/CI usage above.
- Long tool outputs (e.g. a big `run_bash` stdout) are shown in full but with a clear visual boundary, not silently truncated in the terminal even if they were truncated for the model's context (doc 08) — a human reading the terminal shouldn't get less information than what's reasonable to show, even if the model internally worked from a summarized version.

## Design principle

Every UX decision here is downstream of one rule: **the user should always be able to tell, at a glance, what the agent just did or is about to do** — which tool, on which file/command, with what actual content — because that's the thing that makes the confirmation flow (doc 07) meaningful rather than a rubber-stamp "y/n" the user clicks through without really reading.
