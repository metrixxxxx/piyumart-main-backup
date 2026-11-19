# BAO commission withdrawals

BAO/admin accounts withdraw available commission from the shared BAO wallet on
`/bao/finance` or `/dashboard/finance`. BAO payout destinations and withdrawals
do not require manual review or another staff member's approval.

The wallet holds BAO allocations from confirmed online payments, separate from
seller earnings and estimated/uncollected COD commissions. New orders use
[item price tiers](bao-item-price-tiers.md): 0% through PHP 500, 3% above PHP 500
through PHP 5,000, and 5% above PHP 5,000.

## Withdrawal flow

1. Save a BAO bank/e-wallet destination using its BIC, account name and number.
   It is ready to use immediately; account numbers remain encrypted and masked.
2. Select the destination and withdraw at least the configured minimum from
   available commission. The request immediately becomes ready for transfer and
   reserves the amount atomically. No manual approval step is shown or required.
3. A withdrawal completes only after a matching successful PayMongo test transfer
   is verified. The existing transfer processing setting remains unchanged.
   Creating a withdrawal does not initiate a transfer or mark money paid.
4. Cancel a withdrawal before transfer processing begins to release the reservation.
   Cancellation first settles any refund recovery, then returns the remainder to
   available commission. A transfer already attached to the request blocks cancellation.

Internal `approved` status means **Ready for transfer** for BAO requests.
Automatic readiness does not invent a human reviewer or review timestamp.
Cancelled requests remain in history as `cancelled`; retrying their original
idempotency key returns the same cancelled request without reserving again.

Seller destinations and cashouts retain their existing review/approval flow.
BAO manual-review API calls return a conflict explaining that review is not needed.
Only active BAO/admin sessions can create or cancel commission withdrawals.

## Accounting and transfers

The existing minimum, available balance, debt checks, wallet ownership checks,
financial lock, and idempotency rules apply. Concurrent requests cannot overspend.
Pending commission and refund recovery cannot be withdrawn. No seller funds move
when a BAO request is created or cancelled.

The shared wallet follows the configured release policy. By default, the BAO
pending allocation becomes available on buyer confirmation of receipt. A refund
after a completed payout can create recovery debt, blocking new withdrawals and
offsetting future commission releases. COD estimates do not become wallet funds.

Transfer verification still requires test mode, PHP currency, the exact amount,
account name, account number, BIC, and a unique matching provider transfer ID.
Failed transfers release reservations exactly once. `PAYMONGO_PAYOUTS_ENABLED`
continues to control test transfer verification; the change does not enable it.

## Database migration and rollout

Apply `migrations/auto_approve_bao_cashouts.sql` after the existing payment and
`add_bao_commission_cashouts.sql` migrations. It:

- Makes existing pending BAO destinations and cashouts ready automatically,
  retaining encrypted destination data, reservations, balances, and actor IDs.
- Audits each converted record without assigning a fictitious reviewer.
- Adds BAO-only automatic readiness to future default inserts, including inserts
  from the previous deployed application version.
- Allows the `cancelled` cashout status. Seller records are unchanged.

The migration is transactional and safe to replay. Deploy the application changes
to display the new flow and cancellation action. Keep the existing encryption key
and provider configuration. No new API credentials are required.

Applied to the connected Supabase database on November 17, 2026. One existing
pending BAO destination was made ready; there were no pending BAO cashouts to
convert. All seller records and wallet ledger entries were verified unchanged.
The local backup is
`backups/bao-no-review/before-2026-11-17T07-39-12-892Z.json`.
The updated application code still needs deployment for the new wording and
cancellation buttons to appear on the hosted site.

## Verification

```powershell
node --experimental-vm-modules --test tests/payment-security.test.mjs
$env:PIYUMART_FINANCE_DB_TEST='1'
node --experimental-vm-modules --test tests/bao-commission.integration.test.mjs tests/payment-ledger.integration.test.mjs
$env:PIYUMART_REALTIME_DB_TEST='1'
node --experimental-vm-modules --test tests/marketplace-realtime.integration.test.mjs
npm run build
```

Database tests use synthetic records in temporary schemas and mocked provider
responses. They cover migration preservation/replay, no-review destinations and
cashouts, concurrent reservations, cancellation, refund recovery, encrypted
accounts, provider verification, and the existing seller lifecycle. Realtime
tests verify BAO wallet changes reach staff without notifying sellers.

Validation passed: 71 security/database/Realtime tests, component rendering checks
for the removed review actions and transfer/cancel controls, ESLint, and the
production build. The existing middleware deprecation warning remains.
