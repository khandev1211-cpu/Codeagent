import fs from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 200_000; // ~ reasonable cap for source files, doc 05

function isProbablyBinary(buffer) {
  const sampleLen = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleLen; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export const readFile = {
  name: "read_file",
  description: "Read a file's contents so the model can reason about existing code.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path, relative to project root" },
    },
    required: ["path"],
  },
  destructive: false,
  async execute(input, ctx) {
    const resolved = path.resolve(ctx.cwd, input.path);
    let buffer;
    try {
      buffer = await fs.readFile(resolved);
    } catch (err) {
      if (err.code === "ENOENT") {
        return { ok: false, error: `File not found: ${input.path}` };
      }
      if (err.code === "EISDIR") {
        return { ok: false, error: `${input.path} is a directory, not a file` };
      }
      throw err;
    }

    if (isProbablyBinary(buffer)) {
      return { ok: false, error: `${input.path} is a binary file, not readable as text` };
    }

    let text = buffer.toString("utf-8");
    let truncated = false;
    if (buffer.length > MAX_BYTES) {
      text = text.slice(0, MAX_BYTES) + "\n\n[... truncated, file exceeds size cap ...]";
      truncated = true;
    }
    return { ok: true, content: text, truncated };
  },
};
