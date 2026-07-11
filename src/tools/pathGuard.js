import path from "node:path";

/**
 * Resolves `targetPath` against `cwd` and refuses anything that escapes the
 * project root, unless one of `allowedWritePaths` (doc 09) explicitly widens
 * the scope. This is a structural guard — it applies even under --yolo,
 * which bypasses confirmation, not this boundary (doc 07 / doc 15).
 */
export function resolveWritablePath(targetPath, { cwd, allowedWritePaths = ["."] }) {
  const resolved = path.resolve(cwd, targetPath);
  const roots = allowedWritePaths.map((p) => path.resolve(cwd, p));
  const allowed = roots.some((root) => {
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
  if (!allowed) {
    return { ok: false, error: `Refusing to write outside allowed paths: ${targetPath}` };
  }
  return { ok: true, resolved };
}
