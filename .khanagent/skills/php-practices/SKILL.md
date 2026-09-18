---
name: php-practices
description: Write idiomatic modern PHP. Use when writing or reviewing PHP code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# PHP Practices

- Type declarations on function parameters and return types (`function f(int $x): string`) for any modern (PHP 7.4+/8+) codebase — check the actual minimum PHP version in `composer.json` before assuming a feature is available.
- Use the project's existing framework conventions (Laravel, Symfony) rather than bypassing them with raw queries/manual routing for a new feature.
- Prefer strict comparison (`===`) over loose (`==`) — PHP's loose comparison has well-known surprising coercion behavior (`"0" == false`, numeric string comparisons) that's a common source of bugs.
- Use Composer's autoloading and namespaces properly rather than manual `require`/`include` for classes in a project already using Composer.
- Run the project's configured linter/formatter (PHP-CS-Fixer, PHPStan/Psalm for static analysis) after edits (`run_bash`).
- Avoid superglobals (`$_GET`, `$_POST`) accessed directly deep in business logic — use the framework's request abstraction so input handling stays testable.
