import React from "react";

/**
 * codeagent has no build step — no bundler, no Babel, `bin/cli.js` runs
 * directly under Node (doc 03). JSX needs a transform step to exist at
 * all, so these components are written with plain `React.createElement`
 * calls instead. `h` is just a short alias for that, the same convention
 * many JSX-free React/Preact codebases use — this file exists so every
 * TUI component doesn't repeat the same import.
 */
export const h = React.createElement;
