import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DiffTracker } from "./diffTracker.js";

function sessionsDir(homedir = os.homedir()) {
  return path.join(homedir, ".khanagent", "sessions");
}

function newSessionId() {
  return crypto.randomBytes(6).toString("hex");
}

const ID_PATTERN = /^[0-9a-f]{12}$/;
const MAX_NAME_LENGTH = 60;

/** Trims and validates a user-supplied session name. Throws a readable Error. */
export function normalizeSessionName(raw) {
  const name = String(raw ?? "").trim();
  if (!name) throw new Error("Session name can't be empty.");
  if (name.length > MAX_NAME_LENGTH) throw new Error(`Session name is too long (max ${MAX_NAME_LENGTH} characters).`);
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error("Session name can't contain control characters.");
  // Names are resolved after ids, so an id-shaped name (or "last") could never be reached.
  if (ID_PATTERN.test(name) || name.toLowerCase() === "last") {
    throw new Error(`"${name}" is reserved (it looks like a session id, or is the keyword "last"). Pick another name.`);
  }
  return name;
}

export class SessionStore {
  constructor({ homedir = os.homedir(), projectRoot = process.cwd() } = {}) {
    this.dir = sessionsDir(homedir);
    this.projectRoot = projectRoot;
  }

  async _ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  filePathFor(id) {
    return path.join(this.dir, `${id}.json`);
  }

  /** Creates a fresh in-memory session object. Not written to disk until save(). */
  create({ provider, model } = {}) {
    return {
      id: newSessionId(),
      projectRoot: this.projectRoot,
      provider,
      model,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      diffTrackerEntries: [],
    };
  }

  /** Persists after every turn (not just on clean exit) so a killed process loses at most one in-flight turn (doc 08). */
  async save(session) {
    await this._ensureDir();
    session.updatedAt = new Date().toISOString();
    await fs.writeFile(this.filePathFor(session.id), JSON.stringify(session, null, 2), "utf-8");
    return session;
  }

  async load(id) {
    const raw = await fs.readFile(this.filePathFor(id), "utf-8");
    return JSON.parse(raw);
  }

  async loadLastForProject() {
    const sessions = await this.list();
    const matching = sessions
      .filter((s) => s.projectRoot === this.projectRoot)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return matching[0] || null;
  }

  async list() {
    await this._ensureDir();
    const files = await fs.readdir(this.dir);
    const sessions = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(this.dir, file), "utf-8");
        sessions.push(JSON.parse(raw));
      } catch {
        // skip unreadable/corrupt session file rather than failing the whole listing
      }
    }
    return sessions;
  }

  /**
   * Finds a session by exact id or by name (case-insensitive), scoped to
   * this project for names. Ids are only accepted in their real shape, so a
   * reference like "../../x" can never be turned into a file path.
   * Returns null when nothing matches; throws if a name is ambiguous.
   */
  async resolve(ref) {
    const wanted = String(ref ?? "").trim();
    if (!wanted) return null;
    if (ID_PATTERN.test(wanted)) {
      try {
        return await this.load(wanted);
      } catch {
        return null;
      }
    }
    const matches = (await this.list()).filter(
      (s) => s.projectRoot === this.projectRoot && s.name && s.name.toLowerCase() === wanted.toLowerCase()
    );
    if (matches.length > 1) {
      throw new Error(`More than one session is named "${wanted}" (${matches.map((m) => m.id).join(", ")}). Use an id instead.`);
    }
    return matches[0] || null;
  }

  /** Validates `rawName` and checks it's free in the session's project. Returns the normalized name. */
  async #checkedName(session, rawName) {
    const name = normalizeSessionName(rawName);
    const clash = (await this.list()).find(
      (s) => s.projectRoot === session.projectRoot && s.id !== session.id && s.name && s.name.toLowerCase() === name.toLowerCase()
    );
    if (clash) throw new Error(`Another session in this project is already named "${name}" (${clash.id}).`);
    return name;
  }

  /** Gives a session a name, unique within this project. Persists immediately. */
  async rename(session, rawName) {
    session.name = await this.#checkedName(session, rawName);
    return this.save(session);
  }

  /**
   * Branches a session: the new session starts from a copy of the same
   * conversation and then diverges independently. The undo history is NOT
   * copied — it points at file changes made in the original session, and two
   * sessions both able to revert the same change would be a trap. Undo
   * remains available in the session that made the change.
   */
  async fork(session, { name, messages } = {}) {
    const fork = this.create({ provider: session.provider, model: session.model });
    fork.projectRoot = session.projectRoot;
    fork.messages = structuredClone(messages ?? session.messages);
    fork.forkedFrom = session.id;
    // Validated before anything is written, so a bad name leaves no orphan fork behind.
    if (name !== undefined) fork.name = await this.#checkedName(fork, name);
    return this.save(fork);
  }

  diffTrackerFor(session) {
    return DiffTracker.fromJSON(session.diffTrackerEntries, { cwd: this.projectRoot });
  }

  syncDiffTracker(session, diffTracker) {
    session.diffTrackerEntries = diffTracker.toJSON();
  }

  existsSync(id) {
    return fsSync.existsSync(this.filePathFor(id));
  }
}
