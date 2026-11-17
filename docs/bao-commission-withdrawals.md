# BAO commission withdrawals

BAO and admin accounts can now request withdrawals from the shared BAO commission
wallet on `/bao/finance` or `/dashboard/finance`, under **BAO commission wallet**.
This wallet holds the 3% allocation from confirmed online payments. It is separate
from each seller's 97% wallet and from estimated/uncollected COD commissions.

## Use the demo

1. Open Finance as BAO. Add a BAO bank/e-wallet destination using its institution
   BIC, account name and account number.
2. A different BAO staff member or admin approves that destination in Finance.
3. Select the approved destination and request a commission withdrawal. The
   existing minimum cashout applies. Only **available** commission can be reserved;
   pending commission, reserved funds and refund recovery cannot be withdrawn.
4. A different staff member approves the request. The submitter may reject their
   own pending request/destination with a reason, but cannot approve it themselves.
5. Approval leaves the amount reserved. In the current demo, actual transfers
   remain disabled unless an authorized PayMongo TEST Wallet is configured.
   When enabled, staff can verify an existing test transfer ID; only a verified,
   matching successful transfer completes a withdrawal. No success is fabricated.

Rejection and verified transfer failure return the reservation exactly once,
offsetting refund recovery first. Completed withdrawals are recorded separately
from seller withdrawals. The destination, withdrawal history, ledger, and finance
balances update through the existing Supabase Realtime subscriptions.

## Release and refund rules

The shared wallet follows the existing finance release policy: by default, its 3%
pending allocation becomes available when the buyer confirms receipt. Selecting
payment-confirmed release in admin settings applies the existing policy instead.
Withdrawing does not change the configured split or move any seller money.

A refund after a completed BAO payout can create refund recovery debt. That debt
blocks new commission withdrawals and is offset by future commission releases.
Historical COD commission reports are not spendable wallet funds unless an actual
collection has been recorded; this feature does not mint credits for those reports.

## Deployment

Run `migrations/add_bao_commission_cashouts.sql` after the payments migration.
The migration adds destination wallet ownership and submitting/requesting actor IDs,
backfills existing seller metadata, and adds wallet-scoped uniqueness and a composite
foreign key preventing cashouts to a different wallet's destination. Existing
destinations, cashouts, balances, encryption keys and transfer records are retained.

Compatibility triggers populate the new metadata for the previous seller API
inserts. Existing seller uniqueness constraints remain, so the old deployed code
continues to work while the new code is being deployed. The migration supports replay.

The migration has been applied on the connected Supabase database. Preservation
checks confirmed the existing destination data, cashout history and ledger entries
were unchanged. The new application code still needs deployment to Vercel.

Use the existing `WALLET_ENCRYPTION_KEY` and other payment/auth environment variables.
Keep `PAYMONGO_PAYOUTS_ENABLED=false` for the current demo. No new API credentials
are required for requesting/reviewing BAO withdrawals. Deploy the new application
code to Vercel after applying the migration.

## Security and accounting

- The dedicated destination/cashout POST routes require a signed BAO/admin session.
  The service rechecks the actor's active database role inside the transaction.
- Wallet identity, requester and ownership come from the server. Client-sent
  `wallet_id`, `seller_id`, `submitted_by` and `requested_by` values are ignored.
- BAO payout account numbers use the existing AES-GCM encryption. Lists show only
  their last four digits. A destination must belong to the shared commission wallet.
- Requests lock the financial workflow, check the minimum/debt/available funds,
  and reserve atomically. Idempotency keys are unique per wallet and tied to the
  original requester and request contents. Concurrent requests cannot overspend.
- Commission destination submissions, withdrawal requests, approvals/rejections and
  verified payouts are audited with the actual actor. Audit, notification and
  ledger changes are part of the relevant transaction.
- A requester's own approval is rejected by both the UI and server. Transfer
  verification still checks test mode, currency, exact amount, account name,
  account number, BIC and unique provider transfer ID.

## Verification

```powershell
node --experimental-vm-modules --test tests/payment-security.test.mjs tests/seller-verification.test.mjs
$env:PIYUMART_FINANCE_DB_TEST = '1'
$env:PIYUMART_REALTIME_DB_TEST = '1'
node --experimental-vm-modules --test tests/bao-commission.integration.test.mjs tests/payment-ledger.integration.test.mjs tests/marketplace-realtime.integration.test.mjs
npm run build
```

The database suites use synthetic users and isolated temporary schemas, with mock
PayMongo responses. The Realtime suite uses actual Supabase WebSocket delivery.
No real payment, payout, commission withdrawal or seller balance is changed.

Validation passed: production build, 36 security/regression tests, 15 BAO withdrawal
database scenarios, 23 existing financial database scenarios and 10 actual Realtime
WebSocket/database scenarios. Manual browser checks remain the steps below.

After deploying, test with separate BAO/admin browser profiles:

1. Submit a destination as BAO. Confirm self-approval is disabled and the admin
   can approve it. The BAO destination selector should update without reloading.
2. With at least the minimum available commission, request a withdrawal. Available
   should decrease and reserved should increase by exactly the requested amount.
3. Reject it with a reason. Verify the reserve returns and the history/audit update.
4. Submit another request and approve as the other staff account. Verify it stays
   approved/reserved while PayMongo TEST Wallet access is disabled.
5. Check seller balances and seller cashout lists remain separate. A buyer or seller
   calling either BAO withdrawal endpoint must be denied.

## Changed files

```text
app/api/bao/finance/route.js
app/api/bao/finance/wallet/destinations/route.js
app/api/bao/finance/wallet/cashouts/route.js
components/payments/BaoFinance.jsx
components/payments/BaoCommissionWallet.jsx
lib/payments/wallet.js
migrations/add_bao_commission_cashouts.sql
tests/bao-commission.integration.test.mjs
tests/payment-ledger.integration.test.mjs
tests/marketplace-realtime.integration.test.mjs
tests/payment-security.test.mjs
docs/bao-commission-withdrawals.md
docs/paymongo-demo.md
docs/marketplace-realtime.md
```
