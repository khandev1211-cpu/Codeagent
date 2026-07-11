import fs from "node:fs/promises";
import path from "node:path";
import { resolveWritablePath } from "./pathGuard.js";

export const writeFile = {
  name: "write_file",
  description: "Write content to a file, creating it if it doesn't exist or overwriting if it does.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path, relative to project root" },
      content: { type: "string", description: "Full file content to write" },
    },
    required: ["path", "content"],
  },
  destructive: true,
  async execute(input, ctx) {
    const guard = resolveWritablePath(input.path, ctx);
    if (!guard.ok) return guard;

    let previousContent = null;
    let existed = false;
    try {
      previousContent = await fs.readFile(guard.resolved, "utf-8");
      existed = true;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    // Diff Tracker records the before-state before the write actually
    // happens, so an undo is possible even if the write itself throws
    // partway (doc 05 / doc 08).
    ctx.diffTracker?.record({
      path: input.path,
      previousContent: existed ? previousContent : null,
      existed,
    });

    await fs.mkdir(path.dirname(guard.resolved), { recursive: true });
    await fs.writeFile(guard.resolved, input.content, "utf-8");

    return { ok: true, path: input.path, bytesWritten: Buffer.byteLength(input.content, "utf-8") };
  },
};
