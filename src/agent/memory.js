import fs from "fs";
import path from "path";

/**
 * Discovers and reads project instruction files (CODEAGENT.md / CLAUDE.md)
 * and modular rule files inside .codeagent/rules/*.md
 * 
 * @param {string} cwd - The working directory of the project
 * @returns {{ rootFile: string|null, rootContent: string|null, rules: Array<{ filename: string, content: string }> }}
 */
export function discoverProjectMemory(cwd) {
  let rootFile = null;
  let rootContent = null;

  const codeagentMd = path.join(cwd, "CODEAGENT.md");
  const claudeMd = path.join(cwd, "CLAUDE.md");

  if (fs.existsSync(codeagentMd)) {
    rootFile = "CODEAGENT.md";
    rootContent = fs.readFileSync(codeagentMd, "utf8").trim();
  } else if (fs.existsSync(claudeMd)) {
    rootFile = "CLAUDE.md";
    rootContent = fs.readFileSync(claudeMd, "utf8").trim();
  }

  const rules = [];
  const rulesDir = path.join(cwd, ".codeagent", "rules");

  if (fs.existsSync(rulesDir) && fs.statSync(rulesDir).isDirectory()) {
    const files = fs.readdirSync(rulesDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of files) {
      const filePath = path.join(rulesDir, file);
      if (fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, "utf8").trim();
        if (content) {
          rules.push({ filename: file, content });
        }
      }
    }
  }

  return { rootFile, rootContent, rules };
}

/**
 * Formats discovered project memory into a markdown section for the system prompt.
 * 
 * @param {{ rootFile: string|null, rootContent: string|null, rules: Array<{ filename: string, content: string }> }} memory
 * @returns {string|null} Formatted markdown string or null if empty
 */
export function formatMemoryForPrompt(memory) {
  if (!memory || (!memory.rootContent && (!memory.rules || memory.rules.length === 0))) {
    return null;
  }

  let section = "## Project memory & instructions\nFollow these project-specific instructions and guidelines:";

  if (memory.rootContent) {
    section += `\n\n### Instructions from ${memory.rootFile}\n${memory.rootContent}`;
  }

  if (memory.rules && memory.rules.length > 0) {
    for (const rule of memory.rules) {
      section += `\n\n### Rule: ${rule.filename}\n${rule.content}`;
    }
  }

  return section;
}
