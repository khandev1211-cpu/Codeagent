import fs from "node:fs/promises";
import path from "node:path";

/**
 * Records every destructive tool execution's before-state so it can be
 * reverted. Never summarized or pruned for space — undo is a safety
 * guarantee, not something that degrades as a session grows (doc 08).
 */
export class DiffTracker {
  constructor({ cwd, turnId = null } = {}) {
    this.cwd = cwd;
    this.turnId = turnId;
    this.entries = [];
  }

  setTurnId(turnId) {
    this.turnId = turnId;
  }

  record({ path: relPath, previousContent, existed }) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      path: relPath,
      previousContent,
      existed,
      timestamp: new Date().toISOString(),
      turnId: this.turnId,
    };
    this.entries.push(entry);
    return entry;
  }

  list() {
    return this.entries;
  }

  mostRecent() {
    return this.entries[this.entries.length - 1] || null;
  }

  findById(id) {
    return this.entries.find((e) => e.id === id) || null;
  }

  /** Reverts a recorded change by restoring the previous file state (or deleting it if it didn't exist). */
  async revert(entry) {
    const resolved = path.resolve(this.cwd, entry.path);
    if (!entry.existed) {
      await fs.rm(resolved, { force: true });
    } else {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, entry.previousContent, "utf-8");
    }
    // Remove so a repeated `undo` doesn't try to revert the same entry twice.
    this.entries = this.entries.filter((e) => e.id !== entry.id);
  }

  toJSON() {
    return this.entries;
  }

  static fromJSON(entries, opts) {
    const tracker = new DiffTracker(opts);
    tracker.entries = entries || [];
    return tracker;
  }
}
