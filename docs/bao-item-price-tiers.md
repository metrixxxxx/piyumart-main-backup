# BAO commission by item price

New online and cash-on-pickup orders use the following unit-price tiers:

| Item price | BAO commission |
| --- | --- |
| Up to and including PHP 500 | 0% |
| Above PHP 500 through PHP 5,000 | 3% |
| Above PHP 5,000, including prices above PHP 10,000 | 5% |

The selected variant's price determines the tier. Apply that rate to the full
line amount (unit price times quantity), round once to the nearest centavo, and
sum the line commissions per seller order. Sellers receive the remainder.
Four PHP 400 items have no commission. Two PHP 1,000 items have PHP 60 commission.
Adding a PHP 6,000 item produces PHP 360 commission on PHP 9,600 of goods.
Reports show an effective order rate for mixed items (3.75% in that example).

Checkout stores the quoted commission in `orders.bao_commission_amount` for both
payment methods. Online allocations use the same quote; cash commissions are
recorded when the order completes. Product price changes do not alter the quote.
Refunds continue to reverse the original online allocations proportionally,
rather than re-evaluating the tiers against the reduced order amount.

Apply [the migration](../migrations/add_bao_item_price_tiers.sql) after the existing
marketplace payments migration and before deploying this checkout version. It can
be replayed. It adds a nullable quote column, permits zero-rate cash snapshots
without a legacy rate ID, and replaces the fixed online 3% database constraint
with validation against the order's checkout quote.
Existing orders, financial snapshots, wallet entries and balances are retained.
Orders without a quote retain the previous commission rules. The previous cash
rate history remains visible; the single-rate editor/API no longer accepts updates.

Verification:

```powershell
node --experimental-vm-modules --test tests/payment-security.test.mjs
$env:PIYUMART_FINANCE_DB_TEST='1'
node --experimental-vm-modules --test --test-concurrency=1 tests/bao-reporting.integration.test.mjs tests/bao-commission.integration.test.mjs tests/payment-ledger.integration.test.mjs
```

Database tests create temporary schemas with synthetic records and mocked gateway
responses, then remove those schemas. They cover tier boundaries, quantities,
mixed baskets, variant prices, cash completion, refunds, report rates, historical
snapshots, migration replay, retries and wallet releases.
