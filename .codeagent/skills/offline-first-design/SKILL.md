---
name: offline-first-design
description: Design an app/feature to work correctly with intermittent or no network connectivity. Use when building offline support or reviewing how a feature behaves without a network connection.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Offline-First Design

- Design the local-first data flow explicitly: writes go to local storage immediately (so the UI responds instantly) and sync to the server in the background, rather than every write requiring a live network round-trip to feel successful.
- Decide a conflict resolution strategy up front for data that could be edited both locally-while-offline and remotely (last-write-wins, a merge strategy, or surfacing the conflict to the user) — "we'll figure it out" is not a strategy, and the default behavior of most sync libraries isn't always the right one for the specific data.
- Queue actions taken while offline (writes, API calls) and replay them on reconnect, handling the case where a queued action is no longer valid by the time it replays (the resource it referenced was deleted elsewhere in the meantime).
- Show the user their actual connectivity/sync state honestly — a UI that looks fully synced while actually holding unsynced local changes is misleading and erodes trust once a user discovers data was lost.
- Test the actual offline path deliberately (simulate no connectivity, not just "it worked when I tested with wifi on") — offline behavior is exactly the kind of path that's easy to leave untested since the happy path always has a network connection during development.
