import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DiffTracker } from "./diffTracker.js";

function sessionsDir(homedir = os.homedir()) {
  return path.join(homedir, ".codeagent", "sessions");
}

function newSessionId() {
  return crypto.randomBytes(6).toString("hex");
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
