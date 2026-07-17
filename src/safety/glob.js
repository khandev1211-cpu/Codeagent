/**
 * Deliberately minimal glob matching: `*` matches any run of characters,
 * everything else is matched literally. That's the whole feature set — no
 * `?`, no character classes, no `**` recursive-directory semantics —
 * because permission-rule patterns match against a single string (a shell
 * command, a file path) rather than walking a filesystem tree. A fuller
 * glob implementation would be solving a problem this doesn't have.
 */
export function globMatch(pattern, subject) {
  if (typeof subject !== "string") return false;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexSource = "^" + escaped.split("*").join(".*") + "$";
  return new RegExp(regexSource).test(subject);
}
