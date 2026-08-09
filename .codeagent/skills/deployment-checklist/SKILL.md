---
name: deployment-checklist
description: Prepare a change for safe deployment to production. Use before deploying a non-trivial change, especially one involving a migration or a breaking dependency between services.
allowed-tools: read_file, run_bash
---

# Deployment Checklist

1. Database migrations, if any: confirm they're backward-compatible with the currently-running code (additive-first) so a rolling deploy doesn't have old code running against new schema mid-rollout, or vice versa.
2. Feature flags for anything risky or incomplete — deploy the code dark, enable behavior separately, rather than coupling "code is deployed" with "feature is live."
3. Rollback plan — know concretely how to revert (previous image tag, migration rollback, flag off) *before* deploying, not improvised after something breaks.
4. Check for a required order between services if this deploy spans multiple services with a dependency between them (API before consumer, or vice versa depending on the compatibility direction).
5. Monitoring/alerting in place for the specific new failure modes this change could introduce, not just generic uptime checks.
6. Confirm the actual deploy target and that tests/build passed on the exact commit being deployed, not an assumption that "it was fine yesterday."
