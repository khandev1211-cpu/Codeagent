---
name: package-publishing
description: Prepare and publish a package to a registry (npm, PyPI, crates.io, etc.). Use when publishing a new package version or setting up a package for its first publish.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Package Publishing

1. Bump the version correctly first (see semantic-versioning) and confirm it's updated everywhere the project tracks it.
2. Update the changelog for the version being published (see changelog-entry) before publishing, not after.
3. Verify what will actually be published matches what should be — a dry-run pack/build (`npm pack --dry-run`, `python -m build` then inspect, `cargo package --list`, `run_bash`) to check for accidentally-included files (secrets, test fixtures, local config) or accidentally-excluded ones (a file the package needs at runtime).
4. Run the full test suite and lint on the exact commit being published, not an assumption it was fine at some earlier point.
5. Confirm the package's metadata (description, license, repository link, entry points/`bin` field) is accurate and complete — this is what a consumer sees on the registry page and relies on for correct installation.
6. For a first publish specifically, double-check the package name is actually correct and not already taken by something unrelated, and that publish credentials/permissions are configured correctly before attempting.
