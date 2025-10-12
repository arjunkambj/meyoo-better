# Convex Bandwidth Report — last 24 hours

Generated on 2025-10-12 from the Convex dashboard screenshot that lists the heaviest functions in the previous 24-hour window.

## Snapshot

| Function | Environment(s) | 24 h bandwidth | What stands out |
| --- | --- | --- | --- |
| `web/dashboard.getOverviewData` | Dev 3.28 GB · Prod 140.86 MB | Loads the full `orders`, `analytics`, and `metaInsights` datasets for every dashboard view. |
| `web/orders.getFulfillmentMetrics` | Dev 1.41 GB · Prod 183.27 MB | Legacy endpoint still fetching every order-related table to derive fulfillment stats. |
| `web/orders.getOrdersOverviewMetrics` | Dev 337.2 MB · Prod 183.27 MB | Falls back to the raw analytics datasets when daily metrics miss, so it streams huge payloads. |
| `web/orders.getOrdersInsights` | Dev 199.49 MB | Journey helper paginates through Meta insights and daily overview data on each call. |
| `web/orders.getOrdersAnalytics` | Dev 87.92 MB | Streams order chunks plus related tables, then re-sorts and paginates in memory. |
| `web/inventory.getInventoryAnalytics` | Dev 65.01 MB | Pulls every product, variant, inventory total, and recent order item to compute stats. |
| `web/inventory.getInventoryOverview` | Dev 63.2 MB | Legacy overview duplicates the same full-table reads as the analytics query. |
| `web/customers.getCustomersPage` | Dev 60.01 MB | Reads every order in range and then fetches customers one by one. |
| `web/customers.getCustomerJourney` | Dev 41.48 MB | Legacy funnel calculation walks the entire Meta insight history each time. |
| `web/inventory.getProductsList` | Dev 23.7 MB | Legacy list endpoint returns all products with nested variants plus sales metrics. |
| `engine/analytics.gatherAnalyticsOrderChunk` | Prod 19.56 MB · Dev 19.41 MB | Internal chunk reader returns full order, item, transaction, refund, and fulfillment docs. |
| `web/customers.getCustomerList` | Dev 17.09 MB | Legacy cursor-based list loops through every customer and their orders per request. |

## Function notes and follow-ups

### `web/dashboard.getOverviewData`
- **Location:** `apps/backend/convex/web/dashboard.ts:579`.
- **What it does today:** After grabbing the pre-aggregated daily overview, it still calls `loadAnalytics(ctx, orgId, range, { datasets: ["orders","analytics","metaInsights"] })` to rebuild channel revenue and Meta spend.
- **Why the payload is huge:** The `orders` dataset returns every order, related items, and transactions for the whole range. That alone is hundreds of kilobytes per request; multiplied by frequent dashboard refreshes it produced 3.28 GB in dev.
- **Next steps:** Drop the `orders` dataset and reuse the values that are already materialised in daily metrics, or introduce a trimmed helper that only fetches the small pieces still missing (e.g. summary channel totals). Add caching if supplemental data is unavoidable.

### `web/orders.getFulfillmentMetrics`
- **Status:** Removed from the current branch, but the Convex usage report shows clients are still calling the legacy endpoint.
- **Legacy behaviour (commit `861f8497`):** `loadAnalytics(..., { datasets: ORDER_ANALYTICS_DATASETS })` streamed orders, order items, transactions, refunds, fulfillments, variants, and variant costs just to compute a handful of averages.
- **Impact:** Every call transferred several megabytes, leading to 1.41 GB in dev and 183 MB in prod during the day.
- **Next steps:** Ship the new frontend that relies on `getOrdersInsights` (which reads the daily metrics aggregate) and delete or block the old endpoint once traffic drains.

### `web/orders.getOrdersOverviewMetrics`
- **Location now:** `apps/backend/convex/web/orders.ts` (rewritten).
- **Legacy fallback:** When daily metrics were missing it fell back to `loadAnalytics` with the full `ORDER_ANALYTICS_DATASETS`. That turned a lightweight summary into a full table scan.
- **Impact:** 337 MB (dev) and 183 MB (prod) in 24 hours.
- **Next steps:** Ensure daily metrics always exist so the fallback is never triggered, or remove the fallback entirely now that daily metrics generation is stable.

### `web/orders.getOrdersInsights`
- **Location:** `apps/backend/convex/web/orders.ts:567`.
- **What it loads:** `loadOverviewFromDailyMetrics` (cheap) plus `loadCustomerJourneyStages`, which paginates through `metaInsights` at 250 rows per page.
- **Pain point:** Shops with large ad histories accumulate thousands of Meta rows, so the pagination loop still walks and returns a large array.
- **Next steps:** Persist pre-aggregated Meta totals during sync or cap the loop by reading only the totals needed for the funnel.

### `web/orders.getOrdersAnalytics`
- **Location:** `apps/backend/convex/web/orders.ts:363`.
- **What it loads:** Streams chunks from `fetchAnalyticsOrderChunk`, which includes orders, order items, refunds, fulfillments, variants, customers, and variant costs.
- **Why it is heavy:** The handler gathers chunks, sorts them again, and returns full order objects (plus export rows) even if the UI only shows a subset. Chunk size can reach 200 orders, so each response is multi-megabyte.
- **Latest change:** The query no longer streams analytics chunks; it grabs paginated rows directly from `shopifyOrders`, filters in place, and returns the slim fields the table renders.
- **Next steps:** Monitor Convex to confirm the lean path behaves well under search filters and consider adding lightweight profit data if the UI needs it later.

### `web/inventory.getInventoryAnalytics`
- **Location:** `apps/backend/convex/web/inventory.ts:461`.
- **What it loads:** Every product, variant, inventory total, and recent order item, plus variant cost components. All data is returned inline with computed stats.
- **Impact:** 65 MB in dev for a single day of calls.
- **Next steps:** Paginate products server-side, cache variant cost maps, and load sales history from a pre-computed table instead of re-reading all order items.

### `web/inventory.getInventoryOverview`
- **Status:** Legacy endpoint; replaced in code but still invoked in dev.
- **Legacy behaviour:** Duplicated the `getInventoryAnalytics` work—querying all products, variants, inventory totals, and a 90-day order window—only to emit topline numbers.
- **Next steps:** Migrate clients to the new analytics query (which already returns the overview block) and remove the old endpoint.

### `web/customers.getCustomersPage`
- **Location:** `apps/backend/convex/web/customers.ts:274`.
- **What it loads:** Collects every order in range, builds a map of per-customer metrics, and then performs N+1 `ctx.db.get` calls for each customer ID.
- **Impact:** 60 MB of transfer due to unbounded order collection and repeated customer fetches.
- **Next steps:** Switch to a single indexed customer query that joins pre-aggregated stats (materialise them during sync), and cap the order fetch to the page size.

### `web/customers.getCustomerJourney`
- **Status:** Legacy endpoint; still used by older builds.
- **Legacy behaviour:** Similar to the rewritten helper, but executed inside the query by scanning every `metaInsights` row for the selected range and returning the full stage array.
- **Impact:** 41 MB over the day.
- **Next steps:** Reuse the shared `loadCustomerJourneyStages` helper (which already exists) through `getOrdersInsights`, and block the old route once the frontend is updated.

### `web/inventory.getProductsList`
- **Status:** Legacy endpoint replaced by `getInventoryAnalytics`.
- **Legacy behaviour:** Retrieved all products, variants, inventory totals, and recent order items, then returned both paginated pages and a full `data` array per request.
- **Impact:** 23.7 MB in dev within 24 hours.
- **Next steps:** Ensure the UI is calling `getInventoryAnalytics` (which already returns paginated products) and remove the older list query.

### `engine/analytics.gatherAnalyticsOrderChunk`
- **Location:** `apps/backend/convex/engine/analytics.ts:490`.
- **Role:** Internal helper for jobs and chunked analytics loaders. It returns entire arrays for orders, items, transactions, refunds, fulfillments, products, variants, customers, and variant costs in each chunk.
- **Impact:** ~19 MB split between prod and dev.
- **Next steps:** Lower the chunk size (current default is 40–100), skip unused datasets for jobs that only need orders, and consider writing more compact records into staging tables before shipping them to the client.

### `web/customers.getCustomerList`
- **Status:** Legacy cursor endpoint removed from the current branch.
- **Legacy behaviour:** Walked the `shopifyCustomers` index page by page, performed per-customer order queries to compute metrics, and returned both a paginated `page` and a duplicate `data` array.
- **Impact:** 17 MB in 24 hours.
- **Next steps:** Keep the newer `getCustomersPage` in production, update any remaining callers, and delete the legacy endpoint.

## Recommended action plan

1. **Deploy the rewritten queries** so that `getFulfillmentMetrics`, `getInventoryOverview`, `getProductsList`, `getCustomerJourney`, and `getCustomerList` disappear from live traffic. Monitor the Convex dashboard to confirm calls drop to zero, then delete the legacy functionality.
2. **Trim data sets in the remaining hot paths** (`getOverviewData`, `getOrdersAnalytics`, `getCustomersPage`, `getInventoryAnalytics`) so they rely on pre-aggregated tables and return only the fields needed by the UI.
3. **Tune `gatherAnalyticsOrderChunk`** by reducing chunk sizes and omitting unused datasets; that will automatically shrink responses for every consumer that uses the helper.
4. **Add server-side caching or memoization** for expensive supplement reads (Meta insights totals, variant cost maps) to avoid recomputing them on every dashboard refresh.
