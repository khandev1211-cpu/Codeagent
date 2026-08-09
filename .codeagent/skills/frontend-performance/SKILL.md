---
name: frontend-performance
description: Diagnose and fix frontend/web performance issues (slow load, janky interactions, large bundle size). Use when a web UI feels slow or asked to improve frontend performance.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Frontend Performance

1. Measure with real tooling (Lighthouse, browser performance profiler, bundle analyzer, `run_bash`) rather than guessing — "it feels slow" needs a concrete number and a concrete cause before fixing anything.
2. For load time: check bundle size and whether code-splitting/lazy-loading is used for routes/components not needed on initial render, and whether images are appropriately sized/compressed/lazy-loaded.
3. For runtime jank: check for unnecessary re-renders (React/Vue/etc. — is a component re-rendering when its actual inputs haven't changed), and for expensive work happening on the main thread that could be debounced, memoized, or moved off it.
4. Don't add memoization (`useMemo`, `React.memo`, etc.) reflexively — it has its own cost and only helps for a genuinely expensive computation or a genuinely expensive re-render, confirmed by profiling, not by default.
5. Check network waterfall for avoidable sequential requests that could be parallelized, or requests that could be cached/deduplicated.
6. Re-measure after each change against the same metric used for the baseline.
