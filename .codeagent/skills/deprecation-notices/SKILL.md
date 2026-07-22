---
name: deprecation-notices
description: Deprecate an API, function, or feature correctly, giving consumers a clear path forward. Use when removing or replacing something that has existing callers/users.
allowed-tools: read_file, write_file, edit_file
---

# Deprecation Notices

1. Mark it deprecated in a way tooling can surface (a `@deprecated` annotation/decorator the language/IDE recognizes) in addition to documentation — a deprecation only in prose docs is easy for a caller to miss.
2. State what to use instead, concretely — "deprecated" alone without a migration path just tells someone something is wrong without telling them how to fix it.
3. Keep the deprecated thing actually functional during the deprecation window — deprecation is a warning, not an immediate removal; breaking it early defeats the purpose of giving callers time to migrate.
4. Give a real timeline if the project has a convention for one (removed in the next major version, removed after N months) rather than an indefinite "deprecated" that never actually gets removed and just accumulates as permanent clutter.
5. For a widely-used public API, consider a runtime warning (logged once, not spamming) in addition to compile-time/lint-time signals, since not every caller will see documentation or IDE warnings.
6. When the deprecation window ends, actually remove it (see removing-dead-code) — don't let "deprecated" become a permanent state that provides no real signal anymore.
