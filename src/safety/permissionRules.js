import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ConfigError } from "../utils/errors.js";
import { globMatch } from "./glob.js";

/**
 * Which input field a rule's `pattern` matches against, per tool. Only
 * tools with an obviously-right single field to match on are listed —
 * `list_dir`'s `recursive` boolean and similar non-string fields aren't
 * meaningful pattern-match subjects, so tools without an entry here simply
 * can't be targeted by a rule yet (their calls always fall through to the
 * normal confirm/`--yolo` flow, exactly as if Phase 5 didn't exist for
 * them — never a silent security gap, just "no rule can match").
 */
const SUBJECT_FIELD_BY_TOOL = {
  run_bash: "command",
  write_file: "path",
  edit_file: "path",
  read_file: "path",
  list_dir: "path",
  search_code: "query",
};

const RuleSchema = z.object({
  tool: z.string(),
  pattern: z.string(),
  behavior: z.enum(["allow", "deny"]),
});

const RulesFileSchema = z.object({
  rules: z.array(RuleSchema).default([]),
});

/**
 * Loads .codeagent/permissions.json — project-scoped only for v1, same
 * convention as hooks.json (docs/17) and the same reasoning: personal/
 * plugin-scoped rules are a Plugins-phase concern, not bolted on early.
 * Missing file -> no rules, not an error; permission rules are entirely
 * opt-in.
 */
export function loadPermissionRules({ cwd = process.cwd() } = {}) {
  const filePath = path.join(cwd, ".codeagent", "permissions.json");
  if (!fs.existsSync(filePath)) {
    return { rules: [] };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    throw new ConfigError(`Failed to parse permissions config at ${filePath}: ${err.message}`);
  }

  const result = RulesFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid permissions config at ${filePath}:\n${issues}`);
  }
  return result.data;
}

/**
 * Evaluates every configured rule against one tool call. **Deny always
 * wins** when both an allow and a deny rule match the same call — the more
 * restrictive outcome, not "first match" or "last match" — because
 * permission rules are a security-relevant policy layer, and a silently-
 * shadowed deny rule (e.g. a broad allow listed after a narrow deny) would
 * be a much worse failure mode than an occasionally-over-cautious prompt.
 *
 * Returns `{ decision: "allow" | "deny" | "no-match", rule }`. A tool with
 * no entry in SUBJECT_FIELD_BY_TOOL can never match any rule for that
 * tool — always resolves to "no-match", falling through to the normal
 * confirm/`--yolo` flow.
 */
export function evaluatePermissionRules(rules, toolName, input) {
  const subjectField = SUBJECT_FIELD_BY_TOOL[toolName];
  if (!subjectField) return { decision: "no-match", rule: null };

  const subject = input?.[subjectField];
  const matching = rules.filter((rule) => rule.tool === toolName && globMatch(rule.pattern, subject));

  if (matching.length === 0) return { decision: "no-match", rule: null };

  const denyRule = matching.find((r) => r.behavior === "deny");
  if (denyRule) return { decision: "deny", rule: denyRule };

  return { decision: "allow", rule: matching[0] };
}
