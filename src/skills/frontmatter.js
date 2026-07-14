/**
 * Minimal YAML-frontmatter parser, deliberately narrow: flat `key: value`
 * pairs only — no nested structures, no real YAML lists — since that's all
 * SKILL.md needs (`name`, `description`, `allowed-tools` as a comma-
 * separated string). Hand-rolled rather than adding a YAML dependency,
 * matching this project's existing pattern of doing OS/shell/parsing work
 * itself rather than reaching for a library (see keychain.js, runBash.js).
 *
 * Returns `{ frontmatter: Record<string, string>, body: string }`. Throws
 * a descriptive error if the file doesn't open with a `---` block at all —
 * a SKILL.md with no frontmatter is malformed, not "a skill with no
 * metadata."
 */
export function parseFrontmatter(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error("SKILL.md must start with a YAML frontmatter block (---)");
  }

  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (closingIndex === -1) {
    throw new Error("SKILL.md frontmatter block is missing its closing ---");
  }

  const frontmatterLines = lines.slice(1, closingIndex + 1);
  const bodyLines = lines.slice(closingIndex + 2);

  const frontmatter = {};
  for (const line of frontmatterLines) {
    if (!line.trim()) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      throw new Error(`Malformed frontmatter line (expected "key: value"): "${line}"`);
    }
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    frontmatter[key] = value;
  }

  return { frontmatter, body: bodyLines.join("\n").trim() };
}
