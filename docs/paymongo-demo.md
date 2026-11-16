# PiyuMart PayMongo test-mode integration

This is a test-mode integration, matching the requested demo scope. Live API keys
and live webhook events are rejected. No real payment or payout has been performed.
The application does not fabricate a successful gateway response when keys are absent.

## Enable the demo

Local setup completed: the migration has been applied to the connected Supabase
database, the payout destination encryption key has been generated in `.env.local`,
and payout verification remains disabled. PayMongo API/webhook test credentials
are still missing. The installation steps below also document setup for another
environment; do not re-run the creation migration on this installed database.

1. Run [the SQL migration](../migrations/add_marketplace_payments.sql) once in
   Supabase SQL Editor. It was prepared after inspecting the existing database:
   users/orders use integer IDs; finance/commission records use UUIDs. Existing
   commissions and order history are retained. The migration adds financial tables,
   three order columns, private RLS configuration, indexes, foreign keys, and an
   immutable ledger trigger that rejects negative bucket balances.
2. Configure `.env.local` using [.env.payments.example](../.env.payments.example).
   Keep the existing DATABASE_URL, NEXTAUTH_SECRET and Supabase configuration.
3. Obtain a PayMongo **secret test key** from the merchant dashboard's developer
   settings. Hosted checkout availability and enabled methods depend on your
   account. An email requesting linked accounts is not required for this internal
   ledger implementation, but account activation or KYC may still be required.
4. For another environment, generate WALLET_ENCRYPTION_KEY using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   locally. Retain the key already generated here; changing it makes existing encrypted
   payout destinations unreadable. Do not paste credentials in chat or commit them.
5. Restart the dev server. Checkout retains Cash on Pick-up and adds online test
   payment when a test secret is configured. Seller wallets are at `/wallet`, BAO
   finance at `/bao/finance`, and admin finance at `/dashboard/finance`.

The migration is provided separately; test runs use a separate temporary schema.
Do not re-run the creation migration over an already-installed finance schema.

## Environment variables

| Variable | Purpose |
| --- | --- |
| PAYMONGO_SECRET_KEY | Server-only sk_test key; live keys are rejected. |
| PAYMONGO_WEBHOOK_SECRET | Test webhook signing secret, separate from the API key. |
| PAYMONGO_PAYMENT_METHODS | Comma-separated `card,gcash,paymaya,qrph`; restrict this to methods supported by your merchant sandbox. |
| APP_URL | Fixed application origin for redirects. Use a publicly reachable HTTPS URL for webhook testing; localhost is accepted for development redirects. |
| WALLET_ENCRYPTION_KEY | 32-byte AES-256-GCM key encoded as 64 hex characters. |
| PAYMONGO_PAYOUTS_ENABLED | Defaults to disabled; only enable after TEST Wallet/Transfers access works. Does not enable live payouts. |
| CRON_SECRET | Bearer secret protecting reconciliation and existing cron endpoints. |

## Official API choices and marketplace split

The integration uses PayMongo's recommended [Hosted Checkout V2](https://docs.paymongo.com/docs/payment-channels-hosted-checkout):
`POST /v2/checkout_sessions`. Retrieval uses the documented
[`GET /v1/checkout_sessions/{id}`](https://docs.paymongo.com/reference/get_checkout_sessions),
and cancellation/expiry uses
[`POST /v1/checkout_sessions/{id}/expire`](https://docs.paymongo.com/reference/create_checkout_sessions_id_expire).

The documented [linked transaction example](https://docs.paymongo.com/docs/account-settings-linked-transactions)
creates a Payment Intent in a child account's context (`Account-ID`) and sends a
fixed recipient allocation to the parent, leaving the remainder for that child.
That example does not establish that arbitrary sibling child accounts can split a
hosted checkout payment. [Linked-account capabilities](https://docs.paymongo.com/docs/account-settings-account-capabilities)
also require PayMongo approval and active authorized relationships. This demo has
no verified entitlement, child account mappings, or delegated permissions.

Therefore this integration **collects into the configured merchant account and
records the split internally**. It sends no invented split fields and creates no
child accounts. Native account splitting is intentionally not enabled. Enabling it
later requires PayMongo to confirm the intended merchant-of-record, parent/child
arrangement, API contract, and eligibility for all participants.

Each seller's order snapshots a 3% BAO allocation and a 97% seller allocation in
`payment_allocations`, using integer centavos in JavaScript and NUMERIC(14,2) PHP
in Postgres. For PHP 1,000 this is PHP 30 and PHP 970. Rounding is per seller order,
with the seller receiving the remainder so every centavo is accounted for.

Gateway fees are recorded separately. The promised allocation is calculated on
the gross item value, so the merchant must fund fees from its operating money;
the ledger is not proof that enough settled gateway cash exists for disbursement.
Existing scheduled cash-on-pickup commission records remain under Commissions.
Online finance reports use their immutable allocation snapshots and refund offsets.

## Payment lifecycle and idempotency

The frontend sends a stable Idempotency-Key for each checkout. The server ignores
client prices, totals, seller IDs, and email; it reads product/variant prices and
the buyer email from Postgres, locks stock, reserves inventory, and creates one
order per seller in a transaction. One PayMongo payment can cover those orders.

Only signed test webhooks or authenticated server-side provider retrieval can
confirm payment. Visiting a success redirect does not mark anything paid. Payment
confirmation leaves delivery status pending. Seller fulfillment uses the existing
confirmed → processing → shipped flow; only the buyer can confirm receipt.

Successful payments post each allocation into pending wallets. By default, buyer
confirmation moves funds to available. Admin can select payment-confirmed release
or change minimum cashout under financial settings; switching policy does not
retroactively bulk-release balances. Each allocation, release, webhook, refund and
cashout has an idempotency guard. Ledger entries cannot be edited or deleted.

A failed hosted payment attempt stays retryable in the same active session.
Definitive checkout creation rejection records failure and restores inventory.
A network timeout leaves the payment pending for reconciliation; the app does not
blindly send another potentially chargeable POST. Staff can locate its reference
in PayMongo and attach the matching checkout session using Reconcile with PayMongo.

PayMongo does not send a checkout-expired event. Schedule
`GET /api/cron/reconcile-payments` every few minutes with
`Authorization: Bearer <CRON_SECRET>`. The route refreshes pending payments and
attempts provider expiry after 30 minutes. It restores inventory only when the
provider confirms expiration. An ongoing/paid payment that cannot expire keeps
its reservation. The old auto-cancel job excludes online orders.

## Webhook setup

1. Expose the app through a public HTTPS development URL and set APP_URL.
2. In PayMongo's **test** webhook settings, add
   `https://YOUR-APP/api/payments/webhook`.
3. Subscribe to `checkout_session.payment.paid`, `payment.failed`, and
   `payment.refund.updated`. Copy the endpoint's signing secret to the server env.
4. The handler reads the raw body, validates the `te` HMAC-SHA256 signature and
   timestamp in [Paymongo-Signature](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management),
   rejects live events and mismatched amounts/currency/references, and processes
   event claims and financial changes in a single database transaction.
5. Events that race checkout attachment or payment confirmation return a retryable
   error rather than being discarded. Duplicates return success without new credits.

Do not point live webhooks at this demo. Dashboard synthetic events cannot settle
an arbitrary real order: their resource IDs and amount must match the stored test
checkout. Provider keys and full payout account numbers never reach frontend code.

## Wallets and cashouts

Sellers see available, pending, reserved, earnings after refunds, withdrawals,
transaction history, cashout history and approved destinations. Bank/e-wallet
numbers are encrypted at rest; the UI returns only the last four digits. BAO/admin
reviews a destination before it can be used. The institution field is the receiving
bank's BIC as used in PayMongo Transfers.

A cashout transaction locks the wallet, checks the server minimum and approved
destination, and moves available funds to reserved. Concurrent requests cannot
spend the same funds. Rejection releases the reserve. Approval keeps the reserve;
it does not transfer money or complete the request.

For the current demo, automated disbursement initiation is disabled. After PayMongo
activates an authorized **test** Wallet, an authorized operator can initiate a test
transfer through its dashboard and record the `tr_...` ID in the BAO screen. The
backend retrieves [`GET /v2/transfers/{id}`](https://docs.paymongo.com/reference/get-transfer)
and checks test mode, exact PHP amount, account name, number and bank BIC against
the approved destination. Pending means processing; succeeded means completed;
failed releases the reserve. The transfer ID is unique, and completion deducts the
reserve once. A minimal verified transfer receipt/reference is stored as proof.
Approval alone cannot produce a completed cashout. No transfer is submitted by
this implementation, and a typed reference alone cannot fabricate success.

If Wallet access is absent, keep PAYMONGO_PAYOUTS_ENABLED=false. Cashout request,
reservation and BAO approval/rejection can be demonstrated; completion stays
disabled. See [PayMongo's transfer prerequisites](https://docs.paymongo.com/docs/money-movement-moving-money-with-api).

## Refunds and recovery

Initiate sandbox refunds through the authorized PayMongo dashboard. This app
does not create refunds automatically. A signed succeeded refund reverses the
seller and BAO allocations, including partial refunds. Since a group refund does
not identify an order item, each refund is allocated proportionally over remaining
seller-order amounts, with deterministic centavo remainders. Operators must use
separate checkouts if item-specific refund attribution is required.

Before release, refunds reverse pending balances. After release, available funds
are debited; any shortfall after a cashout becomes positive refund-recovery debt,
without a negative wallet. Debt blocks new cashouts and new earnings repay it
first. Pending cashouts can be rejected to release reserves against recovery.
Completed delivery history is retained; fully refunded unfulfilled orders are
cancelled and restore reserved stock once. Completed commission snapshots are
not rewritten.

## Tests and a manual demo

Verified locally: production build, 29 security/regression tests, 22 PostgreSQL
financial scenarios, and 27 HTTP access/smoke checks passed. The database tests
used the isolated schema and mocked provider payloads described below. A real
PayMongo sandbox checkout/webhook and browser visual QA remain unverified because
test credentials are not configured and the browser automation connection is
unavailable in this environment.

```text
npm run build
node --experimental-vm-modules --test tests/payment-security.test.mjs tests/seller-verification.test.mjs
```

The financial integration test is opt-in and requires a Postgres account able to
create an isolated schema. In PowerShell:

```powershell
$env:PIYUMART_FINANCE_DB_TEST = '1'
node --experimental-vm-modules --test tests/payment-ledger.integration.test.mjs
```

It uses synthetic records and mocked official API payloads in a generated
`piyumart_finance_test_*` schema, drops that schema afterward, and never writes to
public marketplace tables or calls PayMongo. It covers monetary rounding, server
pricing, duplicate checkout/webhook/cashout handling, concurrency, reserve release,
confirmed and failed payouts, refunds after withdrawal, debt recovery, rollback,
authorization, and database ledger/RLS protections. These tests are separate from
real sandbox verification.

For a real sandbox walkthrough:

1. Sign in as a buyer and create an online checkout for another seller's approved
   listing. Verify the amount on PayMongo matches the server's product price.
2. Use the [official test payment cases](https://docs.paymongo.com/docs/payment-acceptance-testing)
   for success/decline and the enabled e-wallet/QR sandbox controls. Confirm the
   webhook delivery in the dashboard. A cancelled redirect remains pending until
   the provider session is explicitly expired; QR expiry is not session expiry.
3. Replay a paid event and verify balances do not change. Change the signature or
   amount and verify rejection. A direct success URL must not confirm a charge.
4. Confirm the seller sees pending 97% and BAO pending 3%. Have the seller confirm,
   process and ship; then have the buyer confirm receipt. Verify available balances.
5. Add a payout destination as seller; approve it as BAO. Request more than the
   available amount (must fail), then submit a valid cashout. Duplicate requests
   cannot reserve funds twice. Reject it and verify the reserve is returned.
6. Approve another request. Verify it remains approved/reserved while Wallet access
   is disabled. If an activated test Wallet is available, verify pending, succeeded
   and failed transfer IDs against exact destination details.
7. Refund the sandbox payment via PayMongo. Check both allocations reverse and
   duplicate refund deliveries have no additional effect. Test a partial refund
   and a refund after a cashout; inspect recovery debt and blocked withdrawals.
8. Repeat access tests as logged-out user, another buyer, another seller, BAO and
   admin. Only the owner sees their wallet/payment. Only staff reviews requests;
   only admin changes the minimum/release policy.

## Remaining external approvals and limits

- Actual PayMongo sandbox checkout/webhook testing requires your test API key,
  signing secret, merchant eligibility, HTTPS endpoint, and enabled methods.
- Native marketplace splitting and child-account provisioning require business
  approval and a confirmed parent/child design; they are not enabled in this demo.
- Real transfers, automated disbursement initiation, live keys, and live money are
  intentionally outside the demo. Operator payouts require an authorized Wallet.
- Reports show the latest 100 payment, wallet and cashout records. Existing legacy
  commission reports retain their existing filters and pagination.
- Production requires separate review of settlement funding, fees/taxes, refund
  operations, cashout approvals, account custody and reconciliations. This ledger
  cannot independently prove that gateway cash has settled.

## File inventory for this integration

The inventory is recorded below; earlier seller-verification changes are separate.

```text
.gitignore
.env.payments.example
.env.local (local encryption key and demo payout setting; ignored by Git)
app/(dashboard)/dashboard/page.jsx
app/(dashboard)/dashboard/finance/page.jsx
app/(shop)/checkout/page.jsx
app/(shop)/my-orders/page.jsx
app/(shop)/payments/[id]/page.jsx
app/(shop)/wallet/page.jsx
app/api/admin/orders/[id]/route.js
app/api/bao/finance/route.js
app/api/bao/finance/cashouts/[id]/route.js
app/api/bao/finance/destinations/[id]/route.js
app/api/bao/finance/payments/[id]/route.js
app/api/cron/reconcile-payments/route.js
app/api/my-listings/stats/route.js
app/api/orders/route.js
app/api/orders/[id]/route.js
app/api/payments/config/route.js
app/api/payments/[id]/route.js
app/api/payments/webhook/route.js
app/api/seller/orders/route.js
app/api/seller/orders/[id]/route.js
app/api/wallet/route.js
app/api/wallet/cashouts/route.js
app/api/wallet/destinations/route.js
app/bao/finance/page.jsx
components/bao/BaoHeader.jsx
components/ui/navbar.jsx
components/payments/BaoFinance.jsx
components/payments/FinanceUI.jsx
components/payments/PaymentStatus.jsx
components/payments/SellerWallet.jsx
lib/bao-commission.js
lib/orders/orderService.js
lib/payments/checkout.js
lib/payments/events.js
lib/payments/ledger.js
lib/payments/money.js
lib/payments/paymongo.js
lib/payments/security.js
lib/payments/wallet.js
migrations/add_marketplace_payments.sql
tests/fixtures/finance-base.sql
tests/helpers/load-finance-module.mjs
tests/payment-security.test.mjs
tests/payment-ledger.integration.test.mjs
docs/paymongo-demo.md
```
