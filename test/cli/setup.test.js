import { describe, it, expect, afterEach } from "vitest";
import { SetupWizard } from "../../src/cli/setup.js";

/**
 * Regression coverage for a real crash: `stdin.on("data", onData)` in
 * `_prompt`'s hidden-input branch used to receive raw Buffers (no
 * `setEncoding("utf8")` was ever called), and `char.charCodeAt` threw on
 * the very first keystroke, on every platform. No test exercised this path
 * before, which is exactly how it shipped broken.
 */
describe("SetupWizard._prompt hidden input", () => {
  let originalStdin;

  afterEach(() => {
    if (originalStdin) {
      Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
      originalStdin = null;
    }
  });

  function installFakeStdin() {
    originalStdin = process.stdin;
    const listeners = {};
    const fakeStdin = {
      isRaw: false,
      setRawMode(v) {
        this.isRaw = v;
      },
      setEncoding() {},
      resume() {},
      pause() {},
      on(event, cb) {
        listeners[event] = cb;
      },
      removeListener(event, cb) {
        if (listeners[event] === cb) delete listeners[event];
      },
    };
    Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
    return { fakeStdin, emit: (chunk) => listeners.data && listeners.data(chunk) };
  }

  it("does not crash when data events deliver raw Buffers (the reported bug)", async () => {
    const { emit } = installFakeStdin();
    const wizard = new SetupWizard({ logger: { warn: () => {} } });

    const promise = wizard._prompt({}, "API key: ", null, true);

    expect(() => {
      emit(Buffer.from("s"));
      emit(Buffer.from("e"));
      emit(Buffer.from("c"));
      emit(Buffer.from("r"));
      emit(Buffer.from("e"));
      emit(Buffer.from("t"));
      emit(Buffer.from("\r"));
    }).not.toThrow();

    await expect(promise).resolves.toBe("secret");
  });

  it("handles a multi-character chunk delivered in one event (paste), including Enter mid-chunk", async () => {
    const { emit } = installFakeStdin();
    const wizard = new SetupWizard({ logger: { warn: () => {} } });

    const promise = wizard._prompt({}, "API key: ", null, true);
    emit("pasted-key\r");

    await expect(promise).resolves.toBe("pasted-key");
  });

  it("handles backspace correctly", async () => {
    const { emit } = installFakeStdin();
    const wizard = new SetupWizard({ logger: { warn: () => {} } });

    const promise = wizard._prompt({}, "API key: ", null, true);
    emit("abc");
    emit(String.fromCharCode(127)); // backspace
    emit("\r");

    await expect(promise).resolves.toBe("ab");
  });

  it("falls back to a visible readline prompt when stdin has no setRawMode (non-TTY)", async () => {
    originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", { value: {}, configurable: true });

    const wizard = new SetupWizard({ logger: { warn: () => {} } });
    const fakeRl = {
      question(_q, cb) {
        cb("fallback-value");
      },
    };

    await expect(wizard._prompt(fakeRl, "API key: ", null, true)).resolves.toBe("fallback-value");
  });
});
