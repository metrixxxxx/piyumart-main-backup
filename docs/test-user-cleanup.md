# Delete a test account and its linked history

For the permanent Dashboard/Supabase Delete flow, see [user deletion](user-deletion.md).
The script below remains a separate maintenance tool with preview and backup support.

The financial foreign keys intentionally prevent deleting a user while payment
allocations or wallet records still refer to that account. Keep those constraints
and the application's checkout, payment, wallet, and reporting functions intact.

After confirming that an account and its related history are disposable test data,
use the maintenance script from the repository root:

```powershell
node scripts/purge-test-user.mjs --user-id=21
node scripts/purge-test-user.mjs --user-id=21 --rehearse
node scripts/purge-test-user.mjs --user-id=21 --execute
```

The first command previews counts. Rehearsal runs the deletion in a transaction,
verifies that all other public records and database definitions are unchanged,
then rolls back and verifies restoration. Execution first writes and verifies a
full public-table JSON snapshot under the Git-ignored
`backups/test-user-cleanup/` folder, then performs the same checked deletion and
commits. Backups contain private data; keep them local.

The selection includes legacy orders linked through product IDs, the account's
products and related carts/messages, and the selected orders' test payment and
commission entries. Other users' accounts stay intact. Provider webhook event
deduplication records remain intact. No request is sent to PayMongo and no
Supabase Storage file is deleted.

The script refuses live or unresolved payments, shared payments containing
unrelated orders, mixed legacy orders, external payouts, negative remaining
wallet balances, and records requiring another account's stock or rating totals
to be reconciled. Unexpected foreign keys or side effects roll the transaction
back. This is a test-data maintenance tool, not a production account-deletion API.

Only named immutable-history triggers are temporarily paused, under table locks
inside the deletion transaction; they are restored before commit. Foreign keys
and realtime triggers remain enabled. Database function, constraint, and trigger
definitions are verified unchanged. See PostgreSQL's documentation for
[trigger controls](https://www.postgresql.org/docs/current/sql-altertable.html)
and [table locks](https://www.postgresql.org/docs/current/explicit-locking.html).

## Completed cleanup

On November 17, 2026, user 21 and the approved linked test history were deleted:
16 orders and their items, two test payments and allocations, one product, the
seller wallet and destination, 12 seller/BAO ledger entries, and related test
messages, cart records, notifications, and one audit entry. The verified backup
is `backups/test-user-cleanup/user-21-2026-11-17T06-36-15-069Z.json`.

A fresh read-only connection verified all 35 public tables against the backup:
every remaining row was unchanged, all database function/constraint/trigger
definitions were unchanged, no public trigger was disabled, and no wallet
bucket was negative. Application source files were unchanged.
