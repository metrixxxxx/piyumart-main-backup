# Marketplace live updates

Order changes now use Supabase Realtime Broadcast from database triggers. This
covers COD and PayMongo orders, including the online API branches, webhook payment
confirmation, refunds, reconciliation, and buyer receipt confirmation. Seller
wallets, payout destination/cashout reviews, payment status and BAO/admin finance
also refresh automatically after their database records change.

The [BAO commission withdrawal extension](bao-commission-withdrawals.md) uses the
same staff Realtime feed, including destination reviews, reservations and releases.

## Deployment

The additive migration is `migrations/add_marketplace_realtime.sql`. Apply it after
the payment migration, then deploy the application changes. It installs a private
channel registry and triggers; it does not modify existing order statuses, balances,
account details or payment history. Re-running this migration is supported.

The migration has been installed on the connected Supabase database and all six
triggers are enabled. The Vercel application still needs the new code deployment.

Use the existing `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and custom session configuration in Vercel. No
new Supabase JWT signing secret or Supabase Auth migration is required. Keep the
same database/project configuration in both the server and browser environments.

Open a newly deployed page or reload an existing tab once to install the new
subscription. After that, supported changes appear without refreshing the page.

## Auth and delivery

- `GET /api/realtime/channel` checks the current marketplace session and active
  database account. `?audience=staff` uses the signed BAO/admin cookie and rechecks
  the current staff role. Client-sent user IDs and topics are ignored.
- Each user receives an opaque UUID topic. Its registry has RLS enabled, with no
  grants to `anon` or `authenticated`. The internal sender functions also deny
  direct calls by those roles.
- Since this project uses custom auth, the subscriptions use **public Broadcast
  channels with opaque topics**, not Supabase JWT-authorized private channels.
  Anyone who learns a topic could subscribe to its invalidations. No row data,
  order IDs, balances, names, student documents, or payout details are sent.
  The only application payload is a scope (`orders`, `payments`, `wallet`, or
  `finance`); Supabase adds its own event UUID.
- An event tells the page to refetch through its existing authenticated API.
  A forged Broadcast event cannot approve an order, confirm payment, alter money,
  or expose another user's records. All authorization and payment checks remain
  on the server.
- The database sends only after a transaction commits. Rollbacks emit nothing.
  Unchanged writes are ignored. The client coalesces event bursts for 150 ms and
  refetches after subscribing/reconnecting, returning to the tab, or coming online.
- Realtime is an update signal rather than the financial source of truth. A feed
  failure does not roll back an otherwise valid transaction. A reload, reconnect
  or existing Refresh button recovers authoritative state after missed events.
- Payment status reconciles with PayMongo on entry and manual Refresh. Committed
  webhook/reconciliation updates are then pushed through Supabase; the old
  eight-second provider polling loop is removed.

Supabase relays the committed database state. PayMongo must still deliver its
signed webhook to the deployed application for asynchronous payment confirmation;
the payment page's Refresh button can also reconcile directly with PayMongo.

Supabase describes the database Broadcast transport and its public/private flag
in [Broadcast](https://supabase.com/docs/guides/realtime/broadcast). The SDK and
database settings must agree; this implementation explicitly uses public Broadcast
for small refresh signals instead of streaming private Postgres rows.

## Automated verification

```powershell
node --experimental-vm-modules --test tests/payment-security.test.mjs tests/seller-verification.test.mjs

$env:PIYUMART_REALTIME_DB_TEST = '1'
$env:PIYUMART_FINANCE_DB_TEST = '1'
node --experimental-vm-modules --test tests/marketplace-realtime.integration.test.mjs tests/payment-ledger.integration.test.mjs tests/bao-commission.integration.test.mjs

npm run build
```

The opt-in integrations create validated, randomly named temporary schemas and
drop only those schemas afterward. The Realtime test subscribes to actual
Supabase WebSockets using synthetic, opaque topics and checks committed/rolled
back changes, recipient isolation, payload contents, private registry grants,
seller and buyer API actions, ledger credits, destination approvals and cashouts.
No real order, payment, wallet balance or payout is changed by these tests.

Verification passed: production build, 36 security/regression tests, 10 actual
WebSocket/database scenarios, 23 financial database scenarios and 15 BAO withdrawal scenarios. The channel
registry was verified to have RLS enabled with no anonymous/authenticated read
grants. Browser checks after deploying remain the manual steps below.

## Manual checks after deploying

1. Use separate browser profiles for buyer, seller, and BAO/admin. Open My Orders
   for the buyer, My Listings and Wallet in seller tabs, and Finance for staff.
2. Place a COD order. It should appear on the seller's Orders tab without reload.
   Confirm/process/ship it as the seller and check the buyer's status updates.
3. Complete an online test payment. Both accounts should see its paid state and
   the seller/BAO pending allocations update automatically.
4. Confirm/process/ship the paid order. The buyer's receipt confirmation must
   update the seller's completed count and, under the buyer-confirmation policy,
   transfer the pending wallet earnings into available balances automatically.
5. Submit a payout destination and approve it as BAO. The seller's approved
   destination selector should update without reload. Request and reject a cashout;
   the status and reserved/available buckets should update in the open wallet tab.
6. Temporarily disconnect a browser, change a status from another profile, then
   reconnect or focus its tab. The page should fetch the current state.
7. An unrelated buyer must not see the order. Logged-out requests to the channel
   endpoint return 401; inactive accounts and unauthorized staff requests are denied.

## Files changed for live updates

```text
app/(shop)/my-listings/page.jsx
app/(shop)/my-orders/page.jsx
app/api/orders/[id]/route.js
app/api/seller/orders/[id]/route.js
app/api/realtime/channel/route.js
components/payments/BaoFinance.jsx
components/payments/PaymentStatus.jsx
components/payments/SellerWallet.jsx
lib/realtime/useMarketplaceRealtime.js
migrations/add_marketplace_realtime.sql
tests/helpers/load-finance-module.mjs
tests/marketplace-realtime.integration.test.mjs
tests/payment-ledger.integration.test.mjs
tests/payment-security.test.mjs
docs/marketplace-realtime.md
docs/paymongo-demo.md
```

The preceding order-error fix also changed `lib/payments/events.js` and
`tests/fixtures/finance-base.sql`; those changes are retained.
