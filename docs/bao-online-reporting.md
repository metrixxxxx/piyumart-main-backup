# Online commissions and checkout selection

## Cause and correction

The BAO Commissions API and overview read only `order_commissions`, which
intentionally contains scheduled cash-on-pickup snapshots. Online payments use
`payment_allocations` instead. Inspection found two paid, completed online orders
with valid allocations but no rows in the legacy commission table.

A shared read model now combines both sources. It uses original online allocations
and confirmed refund offsets, never the current cash commission rate. Unpaid,
failed, expired and cancelled checkouts cannot create financial report entries.
Confirmed payments that were subsequently refunded remain in transaction history
with their net amounts. Full refunds reduce the allocation to zero.

Verified online orders appear immediately in **Commission transactions**, including
their payment method, reference and order status. The **Pending online commission**
card covers paid orders awaiting completion. Earned totals and the BAO overview
include completed online orders. The selected date range uses online payment
confirmation or cash snapshot time in Philippine calendar dates. Seller subtotals
include net allocations in that range, including pending online commission.

Both BAO pages refetch their protected APIs on relevant Supabase broadcasts and
when the tab becomes visible again. Financial reports remain private and uncached.
Wallet withdrawal availability continues to follow the existing release policy.

Checkout now uses matching option cards with a single native radio per option.
Only the selected option has the active border, background and icon color. The
online test-mode badge, disabled state, keyboard focus and dark styling are kept.

## Deployment and verification

The reporting fix alone needs no database migration or financial backfill.
The newer [item price tier policy](bao-item-price-tiers.md) requires its migration
before deploying the updated checkout. Restart the local app or
redeploy the application after the repository cleanup. Existing online allocations
are picked up automatically; the read-only validation included both existing
completed online orders. No production orders, wallet entries or balances were
changed for this fix.

1. Open checkout as a buyer. Switch between Cash on Pick-up and PayMongo. Only
   one radio and its card should be selected. Check narrow screens, dark mode,
   label clicks and keyboard navigation. Disabled online payment cannot be chosen.
2. Complete a PayMongo **test** checkout. Once the webhook or provider
   reconciliation confirms payment, open BAO Commissions in another profile.
   The transaction should appear before fulfillment, with 3% pending commission.
   The Online payments page should also contain its payment reference.
3. Approve the order and mark it ready for pickup as the seller. Confirm receipt with a photo as the buyer.
   Commission should move from pending report totals to earned totals and appear
   in the BAO overview without a manual browser reload.
4. Refresh the payment status repeatedly. There should still be one commission
   row per seller order and no duplicated wallet credit. A shared multi-seller
   payment should have one row for each seller order.
5. Check partial/full **test** refunds: net order value, seller allocation and BAO
   commission decrease correctly; the historical transaction remains visible.
   Cancelling an unpaid checkout should not add a commission transaction.
6. Complete a cash order. Its original scheduled rate should remain unchanged,
   alongside the online allocation records. New orders use the
   [item price tiers](bao-item-price-tiers.md). Check date filters and history pagination.
7. Anonymous and ordinary buyer/seller sessions must be denied access to both
   BAO report endpoints.

The payment must be confirmed server-side; a browser success URL alone is never
proof of payment. Configure the Vercel webhook to deliver
`checkout_session.payment.paid`, as documented by
[PayMongo](https://docs.paymongo.com/reference/webhook-resource).

## Automated checks

```powershell
npm.cmd run build
node --experimental-vm-modules --test tests/pagination-cache.test.mjs tests/payment-security.test.mjs tests/seller-verification.test.mjs
$env:PIYUMART_FINANCE_DB_TEST='1'
node --experimental-vm-modules --test tests/bao-reporting.integration.test.mjs tests/payment-ledger.integration.test.mjs tests/bao-commission.integration.test.mjs
```

Database tests use uniquely named temporary schemas, synthetic identities and a
mock PayMongo provider. They drop those schemas afterward. Authenticated browser
and deployment checks above remain manual checks.

## Changed files

- `app/(shop)/checkout/page.jsx`
- `components/payments/PaymentMethodPicker.jsx`
- `lib/bao-commission-report.js`
- `app/api/bao/commissions/route.js`
- `app/api/bao/dashboard/route.js`
- `app/bao/commissions/page.jsx`
- `app/bao/dashboard/page.jsx`
- `components/payments/BaoFinance.jsx`
- `tests/fixtures/finance-base.sql`
- `tests/payment-security.test.mjs`
- `tests/bao-reporting.integration.test.mjs`
- `docs/paymongo-demo.md`
- `docs/bao-online-reporting.md`
