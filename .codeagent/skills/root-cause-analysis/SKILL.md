---
name: root-cause-analysis
description: Go beyond a surface-level fix to find and address the actual underlying cause of a problem. Use after fixing a bug, or when asked to do a root-cause analysis.
allowed-tools: read_file, search_code
---

# Root Cause Analysis

1. Ask "why" repeatedly past the first plausible answer — "the request failed because the input was null" is often not the root cause; ask why the input was null, and why that was possible, until reaching something that's actually addressable at the source.
2. Distinguish the trigger (what specific event caused this instance of the problem) from the root cause (what design/code gap made it possible at all) — fixing only the trigger leaves the gap open for a different trigger to hit it again.
3. Check whether the same root cause could produce other symptoms elsewhere in the codebase — a validation gap that caused one bug might allow other, not-yet-observed bugs through the same gap.
4. Consider contributing factors, not just a single root cause — most real incidents have several conditions that combined to cause the actual failure, and a genuinely resilient fix often needs to address more than one of them.
5. Write the root cause down concretely, in a way a different engineer could understand without having watched the debugging process — "the retry logic didn't account for the downstream service's rate limit, causing a thundering herd," not "there was a bug in the retry code."
6. Prefer a fix that addresses the root cause even if a faster surface patch is available — note the patch as a stopgap explicitly if time pressure requires shipping it first.
