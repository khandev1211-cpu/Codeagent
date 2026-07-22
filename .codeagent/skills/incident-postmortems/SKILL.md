---
name: incident-postmortems
description: Write a postmortem/retrospective document after a production incident. Use when asked to document an incident after it's resolved.
allowed-tools: read_file, write_file
---

# Incident Postmortems

1. Blameless by default — focus on what conditions in the system allowed the incident, not who made the change that triggered it; a postmortem that reads as blame just teaches people to hide problems rather than surface them.
2. Reconstruct an accurate timeline (when the issue started, when it was detected, when it was mitigated, when it was fully resolved) — this is often the hardest part to get right and the most valuable for identifying where detection/response could improve.
3. State actual user impact concretely (duration, scope, severity) rather than vaguely — "the checkout flow returned errors for approximately 40 minutes, affecting an estimated 12% of attempted purchases," not "there was an issue with checkout."
4. Root cause, not just trigger (see root-cause-analysis) — what made this possible, not only what specific event set it off.
5. Concrete, assigned, trackable action items to prevent recurrence or improve detection/response next time — "we should be more careful" is not an action item; "add an alert on X metric crossing Y threshold" is.
6. Publish it somewhere findable and actually follow up on the action items later — a postmortem whose action items are never revisited doesn't actually prevent recurrence.
