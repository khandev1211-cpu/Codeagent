import fs from "node:fs/promises";
import { resolveWritablePath } from "./pathGuard.js";

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1) break;
    count += 1;
    idx = found + needle.length;
  }
  return count;
}

export const editFile = {
  name: "edit_file",
  description:
    "Make a targeted find-and-replace change to part of an existing file, rather than replacing the whole thing.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path, relative to project root" },
      old_content: { type: "string", description: "Exact text to find (must be unique in the file)" },
      new_content: { type: "string", description: "Text to replace it with" },
    },
    required: ["path", "old_content", "new_content"],
  },
  destructive: true,
  async execute(input, ctx) {
    const guard = resolveWritablePath(input.path, ctx);
    if (!guard.ok) return guard;

    let current;
    try {
      current = await fs.readFile(guard.resolved, "utf-8");
    } catch (err) {
      if (err.code === "ENOENT") {
        return { ok: false, error: `File not found: ${input.path}` };
      }
      throw err;
    }

    const occurrences = countOccurrences(current, input.old_content);
    if (occurrences === 0) {
      return {
        ok: false,
        error: `old_content not found in ${input.path}. No changes made — retry with more surrounding context.`,
      };
    }
    if (occurrences > 1) {
      return {
        ok: false,
        error: `old_content matches ${occurrences} locations in ${input.path}, must be unique. Retry with more surrounding context.`,
      };
    }

    ctx.diffTracker?.record({ path: input.path, previousContent: current, existed: true });

    const updated = current.replace(input.old_content, input.new_content);
    await fs.writeFile(guard.resolved, updated, "utf-8");

    return { ok: true, path: input.path };
  },
};
