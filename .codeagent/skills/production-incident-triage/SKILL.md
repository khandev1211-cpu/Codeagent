---
name: production-incident-triage
description: Triage and respond to an active production incident. Use when something is actively broken in production and needs immediate assessment and mitigation.
allowed-tools: read_file, run_bash, search_code
---

# Production Incident Triage

1. Assess actual user impact first (what's broken, for whom, how severely) before diving into root cause — this determines urgency and whether an immediate mitigation (rollback, feature flag off, scaling up) is needed before a proper fix.
2. Mitigate before you fully understand — if a recent deploy is the likely cause, rolling it back to restore service is usually correct even before root cause is confirmed; a full investigation can happen with the fire out.
3. Check what changed recently (deploys, config changes, infrastructure changes, a traffic spike) as the first hypothesis — most incidents correlate with a recent change, not a rare pre-existing bug triggering spontaneously.
4. Communicate status concretely as you go (what's known, what's being tried, current impact) rather than going silent during investigation, if this is happening in a context where others are waiting on updates.
5. Once mitigated, don't stop at "it's fixed" — do the root cause analysis afterward so the actual underlying issue gets addressed, not just this instance of the symptom.
6. Capture a timeline of what happened and when while it's fresh — reconstructing an incident timeline days later from memory is far less reliable.
