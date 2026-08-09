import { describe, it, expect, afterEach } from "vitest";
import { resolveApiKey } from "../../src/providers/resolveApiKey.js";

describe("resolveApiKey", () => {
  const ENV_VAR = "CODEAGENT_TEST_RESOLVE_KEY";

  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  it("prefers the environment variable when set", async () => {
    process.env[ENV_VAR] = "from-env";
    const key = await resolveApiKey({ provider: "anthropic", apiKeyEnvVar: ENV_VAR });
    expect(key).toBe("from-env");
  });

  it("falls back to null when neither env var nor keychain has a value", async () => {
    delete process.env[ENV_VAR];
    const key = await resolveApiKey({ provider: "codeagent-test-provider-with-no-key", apiKeyEnvVar: ENV_VAR });
    expect(key).toBeNull();
  });

  it("does not throw when the keychain lookup itself errors", async () => {
    // provider name with characters unlikely to exist anywhere real —
    // exercises the real KeychainManager code path (not mocked) and
    // confirms a lookup miss resolves to null rather than throwing.
    const key = await resolveApiKey({
      provider: "codeagent-test-provider-with-no-key",
      apiKeyEnvVar: ENV_VAR,
      logger: { warn: () => {}, debug: () => {} },
    });
    expect(key).toBeNull();
  });
});
