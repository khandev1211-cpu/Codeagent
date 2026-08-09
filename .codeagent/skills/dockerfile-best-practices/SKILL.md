---
name: dockerfile-best-practices
description: Write or review a Dockerfile. Use when creating a new Dockerfile or optimizing an existing one for size, build speed, or security.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Dockerfile Best Practices

- Multi-stage builds: build in one stage with full toolchain, copy only the final artifact into a minimal runtime stage — don't ship compilers/build tools in the production image.
- Order layers from least-to-most frequently changing (dependencies before application code) so Docker's layer cache actually gets reused on rebuilds instead of invalidating everything on every code change.
- Pin base image versions (`node:22.4-slim`, not `node:latest`) — a floating tag makes builds non-reproducible and can silently break.
- Run as a non-root user in the final image unless there's a specific reason not to.
- Use a `.dockerignore` to exclude `node_modules`, `.git`, and build artifacts from the build context — a large, unfiltered context slows every build.
- Combine related `RUN` commands to reduce layer count where it meaningfully reduces image size (e.g. `apt-get update && apt-get install && rm -rf /var/lib/apt/lists/*` in one layer, not three).
