# Marketplace performance and reliability

The changes focus on the catalog, inventory, order histories, seller reviews,
seller-application queue, and the Realtime requests those screens generate.
The preceding BAO commission withdrawal work is retained.

## Pagination and bounded payloads

- Home, Products, seller shops, Sell/My Products, My Listings, buyer My Orders,
  seller Orders, seller Reviews and staff Seller Applications now fetch a bounded
  server-side page. Most pages default to 20 records; the hard page-size cap is 48.
- Filters and sorting run in SQL before pagination. Sorts have a unique ID tie
  breaker. Order pagination selects complete orders before joining their items,
  so a multi-item order is not split across pages.
- Global totals, status tab counts and listing statistics come from aggregate
  queries, rather than counting only the displayed page.
- The existing array JSON contracts remain for catalog/inventory/order/review
  routes. Pagination uses `X-Page`, `X-Page-Size`, `X-Total-Count`, and
  `X-Total-Pages`. Order APIs add `X-Status-Counts`; inventory adds
  `X-Total-Listings`/`X-Active-Listings`. Seller Applications retains its
  `{ applications: [...] }` envelope and uses the same page headers.
- Query parameters are `page`, `pageSize`, and the route's filters. Invalid page,
  status, sort and identifier values return 400. Oversized page sizes are capped;
  out-of-range pages skip the row query after counting matches.
- Public catalog descriptions are capped at 500 characters in card responses.
  Product details still return the full description.
- Existing orders without a `seller_id` snapshot remain accessible through their
  seller-owned line items. Other sellers' legacy items are not included.

## Fewer queries and requests

Seller inventory uses five data queries per nonempty page: counts, products,
attributes, images and variants. Related data is fetched with bounded ID arrays
instead of three extra round trips for every product. Buyer history uses three
data queries: counts, orders and all items for that page. Authorization checks
still run separately and are never cached.

Realtime refreshes now respect scopes. An order update refreshes orders/statistics
without also fetching seller inventory and reviews. Wallet/finance/payment pages
ignore unrelated events. Public catalog and seller inventory changes use Supabase
database Broadcast signals instead of the catalog's former Socket.IO subscriptions.
The existing custom-auth channel API still gates user-specific topics. Public
catalog events contain only a scope plus Supabase's event UUID, never product rows,
private documents or user details. Rolled-back changes generate no signal.

The shared read hook cancels superseded requests, hides data when its session is
disabled, resets results on account changes, enforces a client read timeout and
handles non-JSON errors. Search retains its 300 ms debounce; aborted searches no
longer overwrite a newer result. Confirmed actions refresh page metadata, and
deleting a page's final item clamps navigation to the remaining valid page.

## Caching

| Data | Policy |
| --- | --- |
| Categories | Next Data Cache: 300 seconds; public browser cache: 60 seconds; shared HTTP cache: 300 seconds. These are independent cache layers. |
| Featured public products | Next Data Cache: 15 seconds; browser revalidates each request. |
| Category requests in one browser tab | One in-flight request and a 60-second public result cache shared by the footer and page. Failures are not cached. |
| Personalized product pages | Private, `no-store`; viewer filtering and availability are queried on the server. |
| Orders, wallets, finance, applications and private documents | No shared caching. Existing live data and authorization rules remain authoritative. |

Successful catalog and seller-moderation mutations expire the public cache tag
using the supported two-argument `revalidateTag` API. Cache keys include the public
Supabase project URL to distinguish projects. Direct SQL edits and stock changes
can use the short featured-data revalidation window; checkout always validates
current stock, price, role and funds inside the server transaction.

The application has not enabled Next.js Cache Components. The scoped cache uses
the compatible `unstable_cache` Data Cache API supported by the installed Next.js
16 version; its local documentation recommends `use cache` when migrating the app
to Cache Components. This change does not enable that app-wide rendering mode.

## Database and images

`migrations/add_marketplace_performance.sql` adds ten pagination/lookup indexes and
catalog/inventory/review Broadcast triggers. It has been applied to the connected
Supabase database. Preservation checks confirmed products, orders and ledger data
were unchanged. The migration is additive and replayable.

The PostgreSQL pool is reused across module reloads within each process. Defaults
are five connections, a 10-second connection timeout, a 20-second server statement
timeout, and at least a 25-second client query timeout. Idle errors are handled,
TCP keepalive is enabled, and no automatic write retry is introduced.

Optional server environment settings are `DB_POOL_MAX` (1–20),
`DB_CONNECT_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`, and `DB_QUERY_TIMEOUT_MS`.
Values are bounded, and the query timeout stays longer than the statement timeout.
The pool limit applies per process/instance, not to the entire Vercel project.
Changing these settings requires restarting/redeploying the process.

Supported local/Supabase catalog images now use responsive Next Image optimization
and lazy loading. Unsupported external images keep their previous direct-loading
behavior. The configured image allowlist includes the current public Supabase host.

## Measured results and checks

Synthetic database fixture, not a measurement of production traffic:

| Check | Before | After |
| --- | --- | --- |
| Catalog response | 261 full records / 1,341,983 bytes | 20 records / 11,332 bytes |
| Seller inventory data queries | `1 + 3N` | 5 per page |
| Buyer order history data queries | `1 + N` | 3 per page |

The data-query counts exclude the unchanged current-account authorization checks.

Validation passed: production build, 41 unit/security tests, 11 focused performance
database scenarios, 23 payment/ledger scenarios, 15 BAO withdrawal scenarios,
10 Realtime scenarios, and 14 local production HTTP checks. Supabase WebSocket
checks exercised actual delivery, recipient isolation and transaction rollback.

The [HTTP report](performance-http.json) records eight serial warm requests per
endpoint and a small ten-request concurrent read burst. On this local production
run, category/featured warm median responses were 3 ms; the uncached paginated
catalog median was 112 ms. All ten concurrent catalog requests returned 200 with
bounded pages (median 387 ms, p95 428 ms). A supported product image returned as
a 9,600-byte WebP. These figures include the local test conditions; they are not
Vercel latency or capacity guarantees.

```powershell
node --experimental-vm-modules --test tests/pagination-cache.test.mjs tests/payment-security.test.mjs tests/seller-verification.test.mjs
$env:PIYUMART_PERFORMANCE_DB_TEST = '1'
$env:PIYUMART_FINANCE_DB_TEST = '1'
$env:PIYUMART_REALTIME_DB_TEST = '1'
node --experimental-vm-modules --test tests/performance.integration.test.mjs tests/payment-ledger.integration.test.mjs tests/bao-commission.integration.test.mjs tests/marketplace-realtime.integration.test.mjs
npm.cmd run build
```

Integration tests create and drop only validated, randomly named temporary schemas
with synthetic data. They do not seed, withdraw or change real marketplace funds.

## Deploy and manually verify

1. Push all pending application changes, including the preceding BAO withdrawal
   files, and redeploy Vercel. The connected database migrations are installed.
   No new cache provider or secret is required.
2. Reload existing browser tabs once to load the new pagination contract.
3. Browse multiple catalog pages. Change category/search/sort, check that filters
   cover the whole dataset, and verify no repeated products across pages.
4. As a seller, page through inventory, orders and reviews. Check that totals stay
   global and that editing/deleting a record refreshes the appropriate page.
5. As a buyer, switch order-status tabs and navigate pages. Confirm receipt using
   another browser profile and check seller statistics and wallet updates.
6. As BAO/admin, page through approved/rejected applications and verify proof links
   are still signed and permission-controlled. Test commission cashout review.
7. Inspect Network requests: a wallet change should not reload seller inventory;
   an order status change should not reload unrelated reviews. Rapid filter changes
   should cancel obsolete read requests rather than replacing the latest page.

Manual authenticated browser checks and realistic Vercel load/cold-start monitoring
remain necessary. The legacy all-in-one admin dashboard and messaging screens were
not converted to a new data model in this change. External gateway/AI latency and
provider connection quotas still affect overall response times.

## Pending file inventory

The inventory below includes the preceding BAO withdrawal extension, which was
already in the working tree and is retained for the same deployment.

```text
app/(home)/page.jsx
app/(shop)/my-listings/page.jsx
app/(shop)/my-orders/page.jsx
app/(shop)/products/page.jsx
app/(shop)/shop/[sellerId]/page.jsx
app/api/admin/products/[id]/route.js
app/api/admin/products/feature/route.js
app/api/admin/users/[id]/route.js
app/api/bao/finance/route.js
app/api/bao/finance/wallet/cashouts/route.js
app/api/bao/finance/wallet/destinations/route.js
app/api/bao/products/[id]/route.js
app/api/bao/seller-applications/route.js
app/api/bao/sellers/[id]/route.js
app/api/categories/route.js
app/api/my-listings/[id]/route.js
app/api/orders/route.js
app/api/products/featured/route.js
app/api/products/route.js
app/api/products/search/route.js
app/api/sell/route.js
app/api/seller/orders/route.js
app/api/seller/reviews/route.js
components/Footer.jsx
components/SearchAutocomplete.jsx
components/SellManager.jsx
components/bao/SellerApplications.jsx
components/payments/BaoCommissionWallet.jsx
components/payments/BaoFinance.jsx
components/payments/PaymentStatus.jsx
components/payments/SellerWallet.jsx
components/products/ProductCard.js
components/ui/Pagination.jsx
docs/bao-commission-withdrawals.md
docs/marketplace-realtime.md
docs/paymongo-demo.md
docs/performance-http.json
docs/performance.md
lib/catalog-cache.js
lib/catalog.js
lib/client-catalog.js
lib/db.js
lib/orders/read-model.js
lib/pagination.js
lib/payments/wallet.js
lib/realtime/useCatalogRealtime.js
lib/realtime/useMarketplaceRealtime.js
lib/usePagedResource.js
migrations/add_bao_commission_cashouts.sql
migrations/add_marketplace_performance.sql
next.config.mjs
tests/bao-commission.integration.test.mjs
tests/fixtures/performance.sql
tests/helpers/load-finance-module.mjs
tests/marketplace-realtime.integration.test.mjs
tests/pagination-cache.test.mjs
tests/payment-ledger.integration.test.mjs
tests/payment-security.test.mjs
tests/performance.integration.test.mjs
tests/seller-verification.test.mjs
```
