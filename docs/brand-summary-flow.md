# Brand Summary Flow

This document describes how brand-level context is generated and stored for use by the Meyoo AI agent.

## High-Level Steps
1. **Trigger** – When a merchant finishes connecting Shopify during onboarding, the backend schedules:
   - Firecrawl ingestion (`api.agent.firecrawl.seedDocsFromFirecrawl`)
   - Brand summary aggregation (`api.agent.brandSummary.upsertBrandSummary`)
2. **Aggregation** – `upsertBrandSummary` collects storefront metadata and recent Shopify performance (orders, revenue, AOV) via `computeBrandMetrics`.
3. **Persistence** – A formatted summary is added to the org’s RAG namespace with filter values `type: "brand-summary"`.
4. **Consumption** – The agent calls the `brandSummary` tool to retrieve the latest document and ground responses about the brand.

## Key Files
- `apps/backend/convex/agent/brandSummary.ts` – Metrics computation + RAG upsert.
- `apps/backend/convex/core/onboarding.ts` – Schedules the brand summary action post-onboarding.
- `apps/backend/convex/agent/tools.ts` – Defines the `brandSummary` tool for the agent.

## Required Data
- Shopify orders (last 30 days by default) for revenue and order counts.
- Shopify products (first five titles) for highlights.
- Organization/store metadata (name, domain, currency).

## Regeneration
Run the following if you need to rebuild the summary manually:
```ts
await convex.mutation(api.agent.brandSummary.upsertBrandSummary, { lookbackDays: 60 });
```

Adjust `lookbackDays` to change the analytics window.
