# User deletion in the dashboard and Supabase

Apply `migrations/add_user_deletion_cleanup.sql` after the existing payment,
commission cashout, review, and realtime migrations. It adds statement and row
triggers to `users`; the existing dashboard DELETE query and Supabase Table
Editor's Delete action both use the same database cleanup automatically.

Deletion permanently removes an ordinary buyer/seller account, their listings,
related modern and legacy orders, test payments and allocations, seller wallet,
related seller/BAO ledger entries, destinations, reports, messages, carts,
notifications, and other dependent rows. Foreign keys remain enforced. Existing
payment calculations, checkout, refunds, and reporting functions are retained.
Stock reservations, completed sale counts, and review totals on surviving
products are reconciled within the same transaction. Old JWT sessions no longer
authorize deleted accounts.

Global commission settings and unrelated accounts remain intact. An account
cannot be removed while it has unresolved online checkouts, recorded external
payouts, payments shared with unrelated orders, mixed legacy orders belonging to
another buyer, or shared staff attribution. Cleanup also stops if removing its
test credits would leave another wallet bucket negative. These conflicts appear
in the dashboard and Table Editor with a specific reason and roll back the entire
delete. Resolve the indicated test transaction or attribution first.

The new trigger functions use the invoking database role's existing privileges.
No browser permissions or privileged RPC are added. Supabase Table Editor uses
its privileged database role; the app uses its existing server-side Postgres
connection. Table locks and the existing finance advisory locks serialize the
short cleanup. Only the four named immutable-history guards pause inside the
locked transaction; they are restored before it finishes. All other triggers and
foreign keys stay enabled. A failure rolls everything back.

The dashboard reports actual success/failure and removes a user from its list
only after a successful server response. Admin and BAO accounts remain protected.

Verification:

```powershell
node --experimental-vm-modules --test tests/user-deletion.test.mjs
$env:PIYUMART_FINANCE_DB_TEST='1'
node --experimental-vm-modules --test tests/user-deletion.integration.test.mjs tests/payment-ledger.integration.test.mjs
```

Database tests use disposable synthetic schemas. They cover both DELETE entry
points, paid and legacy history, stock/review reconciliation, rollback, bulk
deletion, shared-payment conflicts, and the existing payment/refund/cashout
lifecycle. They do not delete real accounts.

## Connected database

Applied on November 17, 2026. All 35 public tables and every pre-existing
database function, constraint, and trigger definition were verified unchanged.
A synthetic user was deleted successfully inside a rolled-back verification
transaction. No existing account was deleted during installation.

The verified local backup is
`backups/user-deletion-migration/before-2026-11-17T07-01-36-685Z.json`.
The production build, deletion integration tests, auth/security checks, and
existing payment/refund/cashout lifecycle tests passed. The existing middleware
deprecation and two existing product-image lint warnings remain outside this
change.
