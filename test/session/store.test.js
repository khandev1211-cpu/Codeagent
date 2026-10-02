import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SessionStore, normalizeSessionName } from "../../src/session/store.js";

describe("SessionStore: names, resolve, fork", () => {
  let home;
  let store;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "khanagent-sess-"));
    store = new SessionStore({ homedir: home, projectRoot: "/proj/a" });
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  async function seed(messages = [{ role: "user", content: "hi" }]) {
    const s = store.create({ provider: "p", model: "m" });
    s.messages = messages;
    s.diffTrackerEntries = [{ id: "d1" }];
    return store.save(s);
  }

  describe("normalizeSessionName", () => {
    it("trims and accepts ordinary names", () => {
      expect(normalizeSessionName("  auth refactor  ")).toBe("auth refactor");
    });
    it.each([
      ["", /empty/],
      ["   ", /empty/],
      ["x".repeat(61), /too long/],
      ["bad\nname", /control/],
      ["abcdef012345", /reserved/],
      ["Last", /reserved/],
    ])("rejects %j", (input, message) => {
      expect(() => normalizeSessionName(input)).toThrow(message);
    });
  });

  describe("rename + resolve", () => {
    it("a renamed session can be resolved by name (case-insensitive) and by id", async () => {
      const s = await seed();
      await store.rename(s, "Auth Refactor");
      expect((await store.resolve("auth refactor")).id).toBe(s.id);
      expect((await store.resolve(s.id)).id).toBe(s.id);
      expect((await store.load(s.id)).name).toBe("Auth Refactor"); // persisted
    });

    it("returns null for unknown names/ids and for empty refs", async () => {
      await seed();
      expect(await store.resolve("nope")).toBeNull();
      expect(await store.resolve("0123456789ab")).toBeNull();
      expect(await store.resolve("")).toBeNull();
    });

    it("never turns a path-like ref into a file path", async () => {
      fs.writeFileSync(path.join(home, "secret.json"), JSON.stringify({ id: "x", projectRoot: "/proj/a", name: "leak" }));
      expect(await store.resolve("../../secret")).toBeNull();
      expect(await store.resolve("../secret")).toBeNull();
    });

    it("names are unique per project but may repeat across projects", async () => {
      const a1 = await seed();
      const a2 = await seed();
      await store.rename(a1, "work");
      await expect(store.rename(a2, "WORK")).rejects.toThrow(/already named/);
      await store.rename(a1, "work"); // renaming to its own name is fine

      const other = new SessionStore({ homedir: home, projectRoot: "/proj/b" });
      const b = other.create({});
      await other.save(b);
      await other.rename(b, "work");
      expect((await store.resolve("work")).id).toBe(a1.id); // scoped to project a
      expect((await other.resolve("work")).id).toBe(b.id);
    });

    it("reports ambiguity if a hand-edited store has duplicate names", async () => {
      const a = await seed();
      const b = await seed();
      for (const s of [a, b]) {
        s.name = "dup";
        await store.save(s);
      }
      await expect(store.resolve("dup")).rejects.toThrow(/More than one session/);
    });
  });

  describe("fork", () => {
    it("copies the conversation into a new, independent session", async () => {
      const original = await seed([{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]);
      const fork = await store.fork(original, { name: "experiment" });

      expect(fork.id).not.toBe(original.id);
      expect(fork.name).toBe("experiment");
      expect(fork.forkedFrom).toBe(original.id);
      expect(fork.projectRoot).toBe(original.projectRoot);
      expect(fork.messages).toEqual(original.messages);

      // independent: changing the fork leaves the original untouched
      fork.messages.push({ role: "user", content: "only in fork" });
      await store.save(fork);
      expect((await store.load(original.id)).messages).toHaveLength(2);
      expect((await store.load(fork.id)).messages).toHaveLength(3);
    });

    it("does not copy the undo history", async () => {
      const original = await seed();
      const fork = await store.fork(original);
      expect(fork.diffTrackerEntries).toEqual([]);
      expect(fork.name).toBeUndefined();
      expect((await store.load(original.id)).diffTrackerEntries).toEqual([{ id: "d1" }]);
    });

    it("a rejected fork name does not leave the fork unnamed-and-hidden: error propagates, original untouched", async () => {
      const original = await seed();
      await expect(store.fork(original, { name: "last" })).rejects.toThrow(/reserved/);
      expect((await store.load(original.id)).forkedFrom).toBeUndefined();
    });
  });
});
