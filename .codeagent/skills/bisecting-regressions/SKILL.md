---
name: bisecting-regressions
description: Find which specific change introduced a regression using git bisect or an equivalent systematic search. Use when something used to work and now doesn't, and the specific breaking change isn't known.
allowed-tools: read_file, run_bash
---

# Bisecting Regressions

1. First confirm you have a reliable, fast way to check "is the bug present" at any given commit — a flaky or slow reproduction makes bisection unreliable or impractically slow.
2. Use `git bisect` (`run_bash`) rather than manually checking out commits one at a time — it does the binary search for you and is much faster for a long commit range.
3. Mark each tested commit accurately — `git bisect good`/`git bisect bad` based on the actual reproduction check, not a guess; one wrong mark corrupts the whole search.
4. Automate the check if possible (`git bisect run <script>`) for a bug with a scriptable reproduction (a failing test, a specific error from a command) — much faster and more reliable than manual testing at each step.
5. Once the bisect finds the specific commit, read that commit's actual diff to understand *why* it caused the regression, not just accept "this commit is the culprit" as the end of the investigation.
6. If the bisect is inconclusive (a "good" and "bad" commit that both reproduce or don't, unexpectedly), suspect environmental factors (dependency version drift, unrelated flakiness) before assuming the bisection logic itself is wrong.
