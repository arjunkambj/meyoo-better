# Onboarding Cost Storage & Shopify Initial Sync

## Cost Inputs Collected During Onboarding

- **Global operating / shipping / payment fees** come from the onboarding cost form (`SimpleCostsClient`).
  - They persist through the Convex mutation `core.onboarding.saveInitialCosts`.
  - Data lands in the `globalCosts` table with these shapes:
    - `type: "operational"`, `frequency: "monthly"` for operating costs.
    - `type: "shipping"`, `frequency: "per_order"` for per-order shipping.
    - `type: "payment"`, `frequency: "percentage"` for payment gateway fees.
- **Variant-level overrides** (COGS, handling, tax) are managed in `VariantCostsClient`.
  - They save via `core.costs.upsertVariantCosts` / `core.costs.saveVariantCosts`.
  - Values live in the `variantCosts` table and are joined dynamically whenever variants are fetched (no duplication on the Shopify variant documents).

## Shopify Initial Sync Storage Flow

- Credentials and store metadata resolve from `shopifyStores` using `getActiveStoreInternal` before any sync or webhook work.
- **Products & variants** fetched during the initial sync populate `shopifyProducts` and `shopifyProductVariants`, including Shopify attributes like `taxable` and `inventoryItemId`. Any Shopify-provided unit costs are converted into `variantCosts` entries rather than being stored directly on the variant document.
- When a variant arrives with a Shopify cost, the sync calls `internal.core.costs.createVariantCosts` to seed matching `variantCosts` rows and keep COGS aligned.
- **Orders** brought in by the sync (or by the real-time webhook pipeline) persist via `storeOrdersInternal`:
  - Order headers are stored in `shopifyOrders` with financial fields (`totalTax`, `totalPrice`, etc.).
  - Line items store in `shopifyOrderItems`, retaining variant/product references for analytics.
- Webhook handlers reuse the same persistence mutations, so later updates follow identical storage paths.

This mapping keeps onboarding inputs, Shopify import data, and real-time webhook updates consistent across the Convex data model for cost analytics.
