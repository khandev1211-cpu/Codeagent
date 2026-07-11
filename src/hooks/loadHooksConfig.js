import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ConfigError } from "../utils/errors.js";
import { ALL_HOOK_EVENTS } from "./events.js";

const HookDefSchema = z.object({
  matcher: z.string().optional(),
  command: z.string(),
  timeout: z.number().int().positive().optional(),
});

const HooksFileSchema = z.object({
  hooks: z.record(z.enum(ALL_HOOK_EVENTS), z.array(HookDefSchema)).default({}),
});

/**
 * Loads .codeagent/hooks.json from the project root, mirroring the
 * .codeagent/config.json convention already used by config/loader.js
 * (doc 09). Project-scoped only for v1 — personal (~/.codeagent) and
 * plugin-bundled hooks are deferred to the Plugins phase (doc 16), which is
 * where a real multi-scope loading story belongs; adding it here first
 * would be building ahead of its own dependency.
 *
 * Returns { hooks: {} } if the file doesn't exist — hooks are entirely
 * opt-in, so "no file" must mean "zero overhead," not an error.
 */
export function loadHooksConfig({ cwd = process.cwd() } = {}) {
  const filePath = path.join(cwd, ".codeagent", "hooks.json");
  if (!fs.existsSync(filePath)) {
    return { hooks: {} };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    throw new ConfigError(`Failed to parse hooks config at ${filePath}: ${err.message}`);
  }

  const result = HooksFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid hooks config at ${filePath}:\n${issues}`);
  }
  return result.data;
}
