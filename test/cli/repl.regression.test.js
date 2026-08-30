import { describe, it, expect, afterEach } from "vitest";
import { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startRepl } from "../../src/cli/repl.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { SessionStore } from "../../src/session/store.js";
import { DiffTracker } from "../../src/session/diffTracker.js";

/**
 * Regression coverage for a real bug found during a fresh-eyes audit
 * (docs/14): `startRepl` used to create its `readline.Interface` at the
 * very top of the function, before several `await`s (MCP connection,
 * project context, memory file loading) that take real time. Piped,
 * fully-buffered input (a test harness, CI, or `printf "..." | codeagent`)
 * could arrive and be silently consumed by the interface during that
 * setup window — before any `rl.question()` call was pending to receive
 * it — losing the first line entirely.
 *
 * Fixing that first uncovered a second, deeper issue: `readline/promises`'
 * `question()`-in-a-loop pattern has a genuine, separately-reproducible
 * limitation with fully-buffered, immediately-closing piped input — only
 * the first line is ever delivered through nested `question()` calls; a
 * second call made after the stream has already ended never resolves or
 * rejects. The real fix was switching the whole loop mechanism to
 * `for await (const line of rl)`, Node's documented async-iterator
 * pattern, which is driven by the interface's 'line' events directly and
 * correctly delivers every already-buffered line regardless of timing.
 *
 * This test proves multiple piped lines all get processed — not just
 * that the REPL doesn't crash.
 */

function fakeReadableFromLines(lines) {
  const stream = new Readable({ read() {} });
  stream.push(lines.join("\n") + "\n");
  stream.push(null); // EOF — mimics printf's pipe closing immediately after writing
  return stream;
}

function fakeProvider() {
  return {
    async send() {
      return { content: [{ type: "text", text: "ok" }], usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn" };
    },
    countTokens() {
      return 1;
    },
  };
}

describe("startRepl — processes every piped line, not just the first", () => {
  let originalStdin;
  let cwd;
  let homedir;

  afterEach(() => {
    if (originalStdin) {
      Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
      originalStdin = null;
    }
    if (cwd) fs.rmSync(cwd, { recursive: true, force: true });
    if (homedir) fs.rmSync(homedir, { recursive: true, force: true });
  });

  function installFakeStdin(lines) {
    originalStdin = process.stdin;
    const fakeStdin = fakeReadableFromLines(lines);
    Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
  }

  async function runReplWithLines(lines, { config = {} } = {}) {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-repl-test-"));
    homedir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-repl-home-"));
    installFakeStdin(lines);

    const sessionStore = new SessionStore({ homedir, projectRoot: cwd });
    const session = await sessionStore.create({ provider: "test", model: "test-model" });
    const diffTracker = new DiffTracker({ cwd });
    const fullConfig = { maxIterationsPerTurn: 5, ...config };

    await startRepl({
      provider: fakeProvider(),
      toolRegistry: new ToolRegistry([]),
      config: fullConfig,
      logger: { warn: () => {}, info: () => {}, error: () => {} },
      session,
      sessionStore,
      diffTracker,
      cwd,
    });

    return { session, config: fullConfig };
  }

  it("processes multiple piped slash commands in sequence, not just the first", async () => {
    const { config } = await runReplWithLines(["/plan", "/plan"]);
    // Two toggles of planMode (starting false) should land back on false —
    // if only the first line were processed, this would be true instead.
    expect(config.planMode).toBe(false);
  });

  it("processes a /clear after other lines, not just the first piped line", async () => {
    const { session } = await runReplWithLines(["/help", "/clear"]);
    expect(session.messages).toEqual([]);
  });

  it("processes a real (non-slash) turn appearing after other piped lines", async () => {
    const { session } = await runReplWithLines(["/help", "hello agent"]);
    // A real turn ran and appended to history — proves the SECOND piped
    // line reached the orchestrator, not just the REPL's own commands.
    expect(session.messages.length).toBeGreaterThan(0);
  });
}, 15_000);
