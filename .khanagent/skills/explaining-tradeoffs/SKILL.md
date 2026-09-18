---
name: explaining-tradeoffs
description: Clearly explain the tradeoffs of a technical decision to someone who needs to make a call. Use when presenting options for the user to choose between, or explaining why an approach was chosen.
allowed-tools: read_file
---

# Explaining Tradeoffs

1. State what each option actually optimizes for and what it costs — "Option A is faster to build but harder to change later; Option B takes longer now but scales better," not just a feature list of each.
2. Be concrete about the cost, not vague — "harder to change later" is weaker than "changing the data model after this point requires a migration touching every existing row."
3. Don't hide a real preference behind false even-handedness if you have a genuine recommendation and reasoning for it — say which option you'd pick and why, while still giving the other option a fair, accurate description.
4. Ground the tradeoff in this specific situation's actual constraints (team size, timeline, expected scale) rather than generic pros/cons that would apply to any project — a tradeoff that matters at large scale might be irrelevant for a small internal tool.
5. Avoid jargon that obscures rather than clarifies for the audience actually making the decision — match the technical depth to who's asking.
6. If the honest answer is "it genuinely depends on information I don't have" (an unknown future requirement, unclear scale expectations), say that directly rather than picking an option to seem decisive.
