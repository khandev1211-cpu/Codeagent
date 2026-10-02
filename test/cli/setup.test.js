import { describe, it, expect, afterEach } from "vitest";
import { EventEmitter } from "node:events";
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

  function installFakeStdin({ paused = false } = {}) {
    originalStdin = process.stdin;
    const fakeStdin = new EventEmitter();
    Object.assign(fakeStdin, {
      isRaw: false,
      paused,
      setRawMode(v) {
        this.isRaw = v;
      },
      setEncoding() {},
      resume() {
        this.paused = false;
      },
      pause() {
        this.paused = true;
      },
      isPaused() {
        return this.paused;
      },
    });
    Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
    return { fakeStdin, emit: (chunk) => fakeStdin.emit("data", chunk) };
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

  it("leaves a flowing stdin flowing, so the NEXT readline question still receives input (wizard exited right after the API key)", async () => {
    // readline never resumes a stdin it did not pause itself. If the hidden
    // prompt pauses it, the following `Choose model` prompt prints and the
    // process then exits because nothing keeps stdin alive.
    const { fakeStdin, emit } = installFakeStdin({ paused: false });
    const wizard = new SetupWizard({ logger: { warn: () => {} } });

    const promise = wizard._prompt({}, "API key: ", null, true);
    emit("key\r");
    await promise;

    expect(fakeStdin.paused).toBe(false);
    expect(fakeStdin.isRaw).toBe(false);
  });

  it("restores a stdin that was paused beforehand to paused", async () => {
    const { fakeStdin, emit } = installFakeStdin({ paused: true });
    const wizard = new SetupWizard({ logger: { warn: () => {} } });

    const promise = wizard._prompt({}, "API key: ", null, true);
    expect(fakeStdin.paused).toBe(false); // must be resumed to read the key at all
    emit("key\r");
    await promise;

    expect(fakeStdin.paused).toBe(true);
  });

  it("detaches readline's keypress listener while the key is typed, so it is not echoed, and restores it afterwards", async () => {
    // readline in terminal mode echoes every key it sees. With it attached the
    // "hidden" API key was printed to the screen in plain text.
    const { fakeStdin, emit } = installFakeStdin();
    const seen = [];
    const readlineListener = (s) => seen.push(s);
    fakeStdin.on("keypress", readlineListener);
    const wizard = new SetupWizard({ logger: { warn: () => {} } });

    const promise = wizard._prompt({}, "API key: ", null, true);
    expect(fakeStdin.listeners("keypress")).toEqual([]);
    // keypress events a real tty would emit for each character are not delivered to readline
    fakeStdin.emit("keypress", "x");
    expect(seen).toEqual([]);

    emit("secret\r");
    await expect(promise).resolves.toBe("secret");

    expect(fakeStdin.listeners("keypress")).toEqual([readlineListener]);
    fakeStdin.emit("keypress", "y");
    expect(seen).toEqual(["y"]);
  });

  it("restores the keypress listeners even when the key is rejected and re-asked", async () => {
    const { fakeStdin, emit } = installFakeStdin();
    const readlineListener = () => {};
    fakeStdin.on("keypress", readlineListener);
    const wizard = new SetupWizard({ logger: { warn: () => {} } });
    const validator = (v) => (v.trim() ? v.trim() : null);

    const promise = wizard._prompt({}, "API key: ", validator, true);
    emit("   \r"); // blank -> "Invalid input", asks again
    expect(fakeStdin.listeners("keypress")).toEqual([]); // still detached for the retry
    emit("good\r");
    await expect(promise).resolves.toBe("good");

    expect(fakeStdin.listeners("keypress")).toEqual([readlineListener]);
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
