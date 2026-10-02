#!/usr/bin/env node
import { run } from "../src/cli/index.js";

// A reader that closes the pipe early (`khanagent skills | head`) is normal
// shell behaviour, not a failure: exit quietly instead of dumping a stack
// trace. Only EPIPE is swallowed; any other stream error still surfaces.
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (err) => {
    if (err.code === "EPIPE") process.exit(0);
    throw err;
  });
}

run(process.argv);
