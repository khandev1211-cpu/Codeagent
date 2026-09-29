import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";

const BIN = path.resolve(import.meta.dirname, "../../bin/cli.js");

/** Fake OpenAI-compatible server: 1st call asks for git_status, 2nd returns final text. */
function startFakeLlm() {
  let calls = 0;
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      calls += 1;
      const message =
        calls === 1
          ? { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "git_status", arguments: "{}" } }] }
          : { role: "assistant", content: "all clean" };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message, finish_reason: calls === 1 ? "tool_calls" : "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

function runCli(args, { env, cwd }) {
  return new Promise((resolve) => {
    const p = spawn("node", [BIN, ...args], { env, cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("--output-format (real subprocess, fake LLM)", () => {
  let fake, home, project, env;

  beforeAll(async () => {
    fake = await startFakeLlm();
    home = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-of-home-"));
    project = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-of-proj-"));
    execFileSync("git", ["init", "-q"], { cwd: project });
    fs.writeFileSync(
      path.join(home, ".khanagentrc"),
      JSON.stringify({ provider: "ollama", model: "fake", apiKeyEnvVar: "UNUSED_KEY", providers: { ollama: { apiKeyEnvVar: "UNUSED_KEY" } }, ollamaBaseUrl: fake.url })
    );
    env = { ...process.env, HOME: home, USERPROFILE: home, KHANAGENT_PLAIN_REPL: "1" };
  });

  afterAll(() => {
    fake.server.close();
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  });

  it("json: stdout is a single parseable result object", async () => {
    const { code, stdout } = await runCli(["--trust", "--output-format", "json", "check repo"], { env, cwd: project });
    const lines = stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    const result = JSON.parse(lines[0]);
    expect(result).toMatchObject({ type: "result", ok: true, exit_code: 0, result: "all clean" });
    expect(result.usage.input_tokens).toBeGreaterThan(0);
    expect(result.session_id).toBeTruthy();
    expect(code).toBe(0);
  });

  it("stream-json: every stdout line is JSON and the last one is the result", async () => {
    // fresh server state: restart call counter by using a new fake
    const f2 = await startFakeLlm();
    fs.writeFileSync(
      path.join(home, ".khanagentrc"),
      JSON.stringify({ provider: "ollama", model: "fake", apiKeyEnvVar: "UNUSED_KEY", providers: { ollama: { apiKeyEnvVar: "UNUSED_KEY" } }, ollamaBaseUrl: f2.url })
    );
    try {
      const { stdout } = await runCli(["--trust", "--output-format", "stream-json", "check repo"], { env, cwd: project });
      const events = stdout.trim().split("\n").map((l) => JSON.parse(l));
      expect(events.map((e) => e.type)).toEqual(["tool_call", "tool_result", "assistant", "result"]);
      expect(events[0]).toMatchObject({ tool: "git_status" });
      expect(events[3]).toMatchObject({ ok: true, result: "all clean" });
    } finally {
      f2.server.close();
    }
  });

  it("rejects an unknown format and json without a request", async () => {
    const bad = await runCli(["--output-format", "xml", "hi"], { env, cwd: project });
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toMatch(/xml|choices|allowed/i);
    const none = await runCli(["--output-format", "json"], { env, cwd: project });
    expect(none.code).toBe(1);
    expect(none.stderr).toMatch(/one-shot/);
  });

  it("an unreachable LLM still yields exactly one JSON result line with ok:false", async () => {
    fs.writeFileSync(
      path.join(home, ".khanagentrc"),
      JSON.stringify({ provider: "ollama", model: "fake", apiKeyEnvVar: "UNUSED_KEY", providers: { ollama: { apiKeyEnvVar: "UNUSED_KEY" } }, ollamaBaseUrl: "http://127.0.0.1:1" })
    );
    const { code, stdout } = await runCli(["--trust", "--output-format", "json", "hi"], { env, cwd: project });
    const lines = stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ type: "result", ok: false });
    expect(code).not.toBe(0);
    // The provider retries network errors with exponential backoff (~8s), hence the longer timeout.
  }, 30_000);
});
