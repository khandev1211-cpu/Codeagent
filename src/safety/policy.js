/**
 * Reads each tool's own `destructive` flag rather than re-deriving
 * destructiveness from command text — a flat, explicit per-tool flag is more
 * predictable and easier to audit than a heuristic classifier (doc 07).
 */
export function isDestructive(tool) {
  return Boolean(tool.destructive);
}
