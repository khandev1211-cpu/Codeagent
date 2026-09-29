import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The skills shipped inside the installed package (see package.json "files"). */
export const BUNDLED_SKILLS_DIR = path.resolve(__dirname, "../../.khanagent/skills");

/**
 * Copies the bundled example skills into `<cwd>/.khanagent/skills/`.
 *
 * Opt-in on purpose: skills are discovered per project (docs/19), and
 * auto-installing 102 of them would change every user's system prompt
 * without asking. Existing skill folders are never overwritten unless
 * `force` is set, so a customised skill survives a re-run.
 *
 * @returns {{copied: string[], skipped: string[], source: string, dest: string}}
 */
export function initSkills({ cwd, force = false, sourceDir = BUNDLED_SKILLS_DIR } = {}) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`No bundled skills found at ${sourceDir}`);
  }
  const dest = path.join(cwd, ".khanagent", "skills");
  fs.mkdirSync(dest, { recursive: true });

  const copied = [];
  const skipped = [];
  const names = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(sourceDir, e.name, "SKILL.md")))
    .map((e) => e.name)
    .sort();

  for (const name of names) {
    const target = path.join(dest, name);
    if (fs.existsSync(target) && !force) {
      skipped.push(name);
      continue;
    }
    fs.cpSync(path.join(sourceDir, name), target, { recursive: true, force: true });
    copied.push(name);
  }
  return { copied, skipped, source: sourceDir, dest };
}
