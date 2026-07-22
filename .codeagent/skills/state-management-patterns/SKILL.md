---
name: state-management-patterns
description: Decide where and how to manage UI state. Use when adding new state to a frontend component or reviewing state that's become hard to follow.
allowed-tools: read_file, write_file, edit_file, search_code
---

# State Management Patterns

- Keep state as local as possible — lift it up only when it's genuinely shared between components that need it, not preemptively into a global store.
- Derive, don't duplicate — if a value can be computed from existing state/props, compute it at render/use time rather than storing it separately and keeping two things in sync.
- Use the project's existing state management convention (Redux, Zustand, Context, signals, whatever's already there) rather than introducing a second competing pattern for one new feature.
- Server state (data fetched from an API) and client/UI state (a modal's open/closed status) are different concerns — a dedicated data-fetching library (React Query, SWR, or equivalent) usually handles caching/staleness/refetching far better than hand-rolled state for server data.
- Avoid storing the same piece of truth in two places (e.g. both a form's local state and a global store, kept manually in sync) — pick one source of truth per value.
- Name state variables for what they represent, not their type (`isModalOpen`, not `flag1`).
