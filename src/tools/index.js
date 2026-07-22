import { readFile } from "./readFile.js";
import { writeFile } from "./writeFile.js";
import { editFile } from "./editFile.js";
import { listDir } from "./listDir.js";
import { searchCode } from "./searchCode.js";
import { runBash } from "./runBash.js";
import { runSubagentTool } from "./runSubagent.js";
import { webFetchTool } from "./webFetch.js";
import { webSearchTool } from "./webSearch.js";
import { ToolRegistry } from "./registry.js";

// Adding a tool: create a file matching this shape, add it to this list.
// No other file needs to change (doc 05 / doc 11).
export const BUILTIN_TOOLS = [
  readFile,
  writeFile,
  editFile,
  listDir,
  searchCode,
  runBash,
  runSubagentTool,
  webFetchTool,
  webSearchTool,
];

export function createDefaultRegistry() {
  return new ToolRegistry(BUILTIN_TOOLS);
}

export { ToolRegistry };
