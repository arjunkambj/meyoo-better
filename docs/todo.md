# Bandwidth Fix Plan

- [ ] Ship the updated web app so dashboard, orders, customers, and inventory screens call the new Convex queries only.
- [ ] Watch the Convex metrics until the legacy endpoints show zero calls, then gate them behind feature flags to keep old builds out.
- [x] Delete the legacy functions (`getFulfillmentMetrics`, `getInventoryOverview`, `getProductsList`, `getCustomerJourney`, `getCustomerList`) and remove their exports from the generated API. (Verified: no remaining exports or references.)
- [x] Trim `web/dashboard.getOverviewData` so it no longer loads the full `orders` dataset; reuse the daily metrics cache or add a small helper that only grabs the missing revenue totals. (**Done**: daily metrics now store channel revenue, and the query no longer hits `loadAnalytics`.)
- [x] Remove export buttons and bulk export payloads from the dashboard and analytics APIs. (**Done**: UI export controls and related API payloads are stripped so we can revisit exports later as a dedicated reporting feature.)
- [x] Slim down `web/orders.getOrdersAnalytics` by moving pagination into the query, limiting datasets to the fields shown in the table, and offloading CSV export to a background job. (**Done**: the query now reads directly from `shopifyOrders`, performs server-side pagination/filtering, and returns a lean row payload.)
- [x] Break up `web/inventory.getInventoryAnalytics` and `web/customers.getCustomersPage` to read paged summaries from pre-aggregated tables instead of loading every product, variant, order, and customer on each request. (Inventory now serves from `inventoryProductSummaries`; customers use the new `customerMetricsSummaries` snapshot with auto-refresh.)
