import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Global registry, keyed by realpath (docs/30) — a per-project trust
 * marker living INSIDE the folder whose trust is in question would be
 * trivially bypassable (a malicious repo could ship a pre-trusted
 * marker file). Same home-directory-namespace convention as
 * `~/.codeagent/sessions/`, `~/.codeagent/usage/`.
 */
function trustFilePath(homedir = os.homedir()) {
  return path.join(homedir, ".codeagent", "trustedFolders.json");
}

/**
 * Resolves symlinks before checking/storing trust, so a symlink pointing
 * into an already-trusted directory doesn't create a second, separate
 * trust entry, and — more importantly — a symlink crafted to *look* like
 * a path outside a trusted folder but actually resolve inside it doesn't
 * bypass the gate in either direction. Falls back to the raw path if
 * `realpathSync` fails (e.g. the directory doesn't exist yet in some
 * edge case) rather than throwing — trust-checking should never be the
 * reason a command crashes.
 */
export function resolveTrustKey(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

async function readRegistry(homedir) {
  try {
    return JSON.parse(await fsPromises.readFile(trustFilePath(homedir), "utf-8"));
  } catch {
    return {};
  }
}

async function writeRegistry(homedir, registry) {
  const filePath = trustFilePath(homedir);
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, JSON.stringify(registry, null, 2), "utf-8");
}

export async function isFolderTrusted(targetPath, { homedir = os.homedir() } = {}) {
  const key = resolveTrustKey(targetPath);
  const registry = await readRegistry(homedir);
  return Boolean(registry[key]);
}

/**
 * The only way trust is GRANTED (docs/30 — deliberately no standalone
 * `trust add` command): either this is called after the real prompt
 * returns "yes," or from the `--trust` CLI flag on an actual invocation.
 * A bare "add trust for a path" command would let trust be granted for a
 * folder codeagent was never actually run in, undercutting the point of
 * a gate meant to be a considered, in-the-moment decision.
 */
export async function trustFolder(targetPath, { homedir = os.homedir() } = {}) {
  const key = resolveTrustKey(targetPath);
  const registry = await readRegistry(homedir);
  registry[key] = { trustedAt: new Date().toISOString() };
  await writeRegistry(homedir, registry);
  return key;
}

export async function revokeFolder(targetPath, { homedir = os.homedir() } = {}) {
  const key = resolveTrustKey(targetPath);
  const registry = await readRegistry(homedir);
  const existed = Boolean(registry[key]);
  delete registry[key];
  await writeRegistry(homedir, registry);
  return existed;
}

export async function revokeAllFolders({ homedir = os.homedir() } = {}) {
  await writeRegistry(homedir, {});
}

/** Returns `[{ path, trustedAt }]`, sorted most-recently-trusted first — matches `codeagent sessions`'/`codeagent usage`'s existing "newest first" listing convention. */
export async function listTrustedFolders({ homedir = os.homedir() } = {}) {
  const registry = await readRegistry(homedir);
  return Object.entries(registry)
    .map(([folderPath, meta]) => ({ path: folderPath, trustedAt: meta.trustedAt }))
    .sort((a, b) => new Date(b.trustedAt) - new Date(a.trustedAt));
}

/**
 * Commands that never actually touch the project directory (docs/30's
 * "When the prompt fires" section has the full reasoning per command) —
 * exempt from the trust gate entirely. Read-only discovery/listing
 * commands (`skills`, `hooks`, etc.) are exempt for the same "visibility
 * before any install machinery" reasoning docs/17/19/22/24/25 already
 * established for those commands individually — gating them would mean
 * `codeagent skills` on an untrusted folder either silently fails to be
 * useful or forces a trust decision before the user has any information
 * to decide with.
 */
export const TRUST_EXEMPT_COMMANDS = new Set([
  "setup",
  "config",
  "providers",
  "use",
  "models",
  "mistral-models",
  "system-prompt",
  "skills",
  "subagents",
  "memory",
  "commands",
  "mcp",
  "hooks",
  "permissions",
  "sessions",
  "usage",
  "quota",
  "trust",
]);
