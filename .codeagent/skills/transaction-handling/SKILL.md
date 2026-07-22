---
name: transaction-handling
description: Correctly wrap multi-step database operations in transactions. Use when a change involves multiple related writes that must succeed or fail together.
allowed-tools: read_file, write_file, edit_file, search_code
---

# Transaction Handling

- Any set of writes where a partial failure would leave data inconsistent (e.g. debit one account, credit another) needs a transaction — identify this before writing the code, not after finding a bug.
- Keep transactions short — don't do slow, unrelated work (an external API call, heavy computation) inside an open transaction; it holds locks longer than necessary and increases contention.
- Handle the failure path explicitly — know what happens to already-executed statements when a later one in the same transaction fails, and make sure the rollback is actually triggered, not just assumed.
- Understand the isolation level the project/database actually uses by default — the difference between read-committed and serializable is a common source of subtle bugs under concurrent load.
- For operations spanning multiple services/databases (no single transaction can cover both), consider an explicit compensating-action or saga pattern rather than pretending a distributed operation is atomic when it isn't.
- Test the actual failure path — force a mid-transaction error in a test and confirm the rollback leaves the data in the expected prior state.
