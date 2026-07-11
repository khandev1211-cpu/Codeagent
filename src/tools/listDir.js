import fs from "node:fs/promises";
import path from "node:path";
import { loadGitignore } from "./gitignore.js";

async function walk(dir, { recursive, ignore, cwd, depth = 0, maxDepth = 6 }) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(cwd, full);
    if (ignore(rel)) continue;
    if (entry.isDirectory()) {
      const node = { name: entry.name, type: "dir" };
      if (recursive && depth < maxDepth) {
        node.children = await walk(full, { recursive, ignore, cwd, depth: depth + 1, maxDepth });
      }
      nodes.push(node);
    } else {
      nodes.push({ name: entry.name, type: "file" });
    }
  }
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}

function renderTree(nodes, prefix = "") {
  let out = "";
  nodes.forEach((node, i) => {
    const last = i === nodes.length - 1;
    out += `${prefix}${last ? "└── " : "├── "}${node.name}${node.type === "dir" ? "/" : ""}\n`;
    if (node.children) {
      out += renderTree(node.children, prefix + (last ? "    " : "│   "));
    }
  });
  return out;
}

export const listDir = {
  name: "list_dir",
  description: "Explore project structure as a tree, respecting .gitignore.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path, relative to project root", default: "." },
      recursive: { type: "boolean", description: "Recurse into subdirectories", default: false },
    },
    required: [],
  },
  destructive: false,
  async execute(input, ctx) {
    const target = path.resolve(ctx.cwd, input.path || ".");
    const ignore = await loadGitignore(ctx.cwd);
    let nodes;
    try {
      nodes = await walk(target, { recursive: !!input.recursive, ignore, cwd: ctx.cwd });
    } catch (err) {
      if (err.code === "ENOENT") return { ok: false, error: `Directory not found: ${input.path}` };
      if (err.code === "ENOTDIR") return { ok: false, error: `${input.path} is not a directory` };
      throw err;
    }
    return { ok: true, tree: renderTree(nodes) || "(empty)" };
  },
};
