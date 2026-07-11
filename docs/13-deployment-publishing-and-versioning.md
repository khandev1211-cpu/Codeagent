# 13 — Deployment, Publishing & Versioning

## Versioning

Standard semver:
- **Patch** (`1.0.x`): bug fixes, no behavior change to any documented interface (tool schemas, CLI flags, config schema).
- **Minor** (`1.x.0`): new tools, new config options, new CLI flags/commands — additive, backward compatible.
- **Major** (`x.0.0`): any change to the core loop's contract (doc 04), a tool's `input_schema` in a way that changes what the model must provide, removal of a config option or CLI flag, or any change to default behavior a user would notice without opting in (e.g. changing what's destructive-by-default).

Given the extensibility design (doc 11) — new tools/providers/config options are meant to be additive — most day-to-day growth of this project should land as minor releases, not major ones. A major release should be a deliberate, rare event.

## Changelog

`CHANGELOG.md` follows Keep a Changelog conventions: an `Unreleased` section accumulates entries as PRs land, moved to a dated version section at release time. Every entry is user-facing language ("what changed for someone using codeagent"), not a raw commit-message dump.

## Pre-publish checklist (enforced by `prepublishOnly`, doc 03, plus manual steps from doc 12)

Automated (cannot publish without these passing):
1. Lint passes.
2. Full test suite passes.

Manual, before running `npm publish`:
1. `CHANGELOG.md` updated with the new version's entries.
2. `package.json` version bumped according to semver rules above.
3. `npm pack --dry-run` reviewed — confirms exactly the files listed in `package.json`'s `"files"` field (doc 03) are what would actually be published, catching any accidental inclusion of `.env`, local session data, or test fixtures.
4. Manual QA checklist from doc 12 run against the built package (not just the dev source) — ideally by actually `npm install -g`-ing a `npm pack` tarball locally and running it, so the test matches what a real user would get.
5. Git tag matching the version, pushed alongside the release.

## Publish command

```
npm publish
```

Run only after the checklist above, and only from a clean working tree on the release branch — never from a local branch with uncommitted or unreviewed changes, since there's no way to "unpublish and fix" cleanly on npm once a version is out.

## CI/CD pipeline (GitHub Actions)

- **On every PR/push:** lint + full test suite (doc 12) across the supported Node version matrix.
- **On a version tag push:** an optional automated publish job can run `npm publish` directly from CI using a scoped npm token, *if* the manual checklist above has already been satisfied and the tag itself represents a reviewed, merged release — this automates the mechanical publish step, it does not replace the manual QA judgment calls.

## Rollback

npm does not support true unpublish/replace for most packages after a short window. The practical rollback strategy is:
1. Publish a new patch version with the fix immediately.
2. If the bad version is actively harmful (not just buggy), use `npm deprecate` on the bad version to warn anyone who installs it, pointing them to the fixed version.

This is why the pre-publish checklist above exists — prevention is far cheaper than rollback for an npm package.
