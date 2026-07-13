import { KeychainManager } from "../utils/keychain.js";

/**
 * Resolves an API key for a provider: the environment variable first (no
 * shell-out needed, and an explicit env var should always win if someone
 * has set one), falling back to the OS keychain if the setup wizard saved
 * one there.
 *
 * This closes a real gap: `codeagent setup` could save a key to the
 * keychain, but until now nothing ever read it back — `_apiKey()` in every
 * provider adapter checked `process.env` only. Persisted setup was
 * effectively silent.
 */
export async function resolveApiKey({ provider, apiKeyEnvVar, logger } = {}) {
  const fromEnv = apiKeyEnvVar ? process.env[apiKeyEnvVar] : undefined;
  if (fromEnv) return fromEnv;

  const keychain = new KeychainManager({ logger });
  try {
    const fromKeychain = await keychain.getKey(provider);
    return fromKeychain || null;
  } catch {
    // A broken keychain lookup must not crash provider construction — it
    // just means no key was found this way; the caller's own "missing key"
    // error path (already tested) handles the rest.
    return null;
  }
}
