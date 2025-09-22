# AI Flow Overview

This document outlines the current AI/agent capabilities in the Meyoo monorepo, focusing on backend flows, available tools, data sources, and key environment requirements. Use it as the reference when wiring new agent features or debugging existing ones.

## Architecture Snapshot

- **Convex Agent component** (`@convex-dev/agent`) provides thread/message storage and tool orchestration.
- **Convex RAG component** (`@convex-dev/rag`) stores embeddings and contextual documents for org-scoped retrieval.
- **Firecrawl ingestion** pulls external website content into the RAG store during onboarding.
- **Shopify ingestion** summarizes storefront data (products/orders) into RAG for org-defined namespaces.

All Convex functions live under `apps/backend/convex`. Client hooks consume the generated Convex API via `apps/web/hooks`.

## Key Agent Entry Points

### Agent Factory
- `apps/backend/convex/agent/agent.ts`
  - Wraps Convex components to create a default agent instance with shared instructions and tools.
  - Tools registered at creation include:
    - `searchCustomers`
    - `analyticsSummary`
    - `metaAdsOverview`
    - `currentDate`
  - Defaults:
    - Model: `openai:gpt-4o-mini`
    - Namespace: `components.agent`
    - System prompt notes include today’s date (ISO 8601) so the model is aware of “current” timeline.

### Agent Actions & Queries
- `apps/backend/convex/agent/action.ts`
  - `sendMessage` – orchestrates create-thread & generateText calls, saving transcripts.
  - `deleteThread` – cleans up thread history (messages + streams).
- `apps/backend/convex/agent/chat.ts`
  - `listThreads`
  - `renameThread`
  - `listMessages`

### Firecrawl Ingestion
- `apps/backend/convex/agent/firecrawl.ts`
  - `seedDocsFromFirecrawl` (action): Crawl docs and add markdown pages to RAG.
  - `getOnboardingForOrg`/`markFirecrawlSeeded` (internal) – ensures one-time seeding.

### Brand Summary Ingestion
- `apps/backend/convex/agent/brandSummary.ts`
  - `computeBrandMetrics` (internal query): Collects revenue/order metrics and storefront info.
  - `upsertBrandSummary` (action): Converts org/shop data into a concise brand overview document stored in RAG.

## RAG Configuration

- `apps/backend/convex/rag.ts` instantiates a `RAG` component with filters:
  - `type` – content category (`product`, `order`, `firecrawl-doc`, `summary`, ...)
  - `resourceId` – original resource identifier (Shopify ID or URL).
  - `timeBucket` – for time-series aggregations (orders).
- Embedding model: `openai.embedding("text-embedding-3-small")`
  - Requires `@ai-sdk/openai` + `ai` packages.
  - Ensure `OPENAI_API_KEY` is present in Convex env.

## Agent Tools

### 1. `searchCustomers`
- File: `apps/backend/convex/agent/tools.ts`
- Summary: Search customers by name/email, returning high-level profile metrics (orders, LTV, segment).
- Data Source: `api.web.customers.getCustomerList`
- Exposure: Added to default agent when `createAgent()` is called.

### 2. `analyticsSummary`
- File: `apps/backend/convex/agent/tools.ts`
- Summary: Summaries metrics over a date range (granularity + optional metric list).
- Data Source: `api.web.analytics.getMetrics`
- Notes: Aggregates totals from raw rows; returns computed summary string + records for inspection.

### 3. `metaAdsOverview`
- File: `apps/backend/convex/agent/tools.ts`
- Summary: Meta ads performance snapshot (impressions, CTR, conversion, spend KPIs).
- Data Source: `api.web.analytics.getPlatformMetrics`
- Uses: Derive marketing insights for agent responses.

### 4. Firecrawl Seeding Utility
- Indirect tool triggered via onboarding; not exposed as a direct agent tool.
- Action `seedDocsFromFirecrawl` uses Firecrawl API (`FIRECRAWL_API_KEY`) to gather docs and push to RAG.

### 5. Current Date Tool
- File: `apps/backend/convex/agent/tools.ts`
- Summary: Provides the current date/time (UTC) in ISO formats to keep responses anchored to “today”.
- Usage: Automatically available to the agent as `currentDate`.

### 6. Brand Summary Tool
- File: `apps/backend/convex/agent/tools.ts`
- Summary: Surfaces the latest stored brand overview, including storefront, product highlights, and recent sales stats sourced from RAG.
- Usage: Available to the agent as `brandSummary`.

## Onboarding Integration

- `connectShopifyStore` (in `core/onboarding.ts`) now:
  - Updates onboarding record (`firecrawlSeededAt`, `firecrawlSeededUrl`).
  - Calls Firecrawl ingestion once per org (auto-skip if already seeded).
  - Continues to run initial Shopify sync through existing pipeline.

### Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | ✅ | Embeddings + agent text generation |
| `FIRECRAWL_API_KEY` | ✅ (for Firecrawl seeding) | Auth to Firecrawl API |
| `FIRECRAWL_API_BASE_URL` | Optional | Override Firecrawl host (defaults to `https://api.firecrawl.dev`) |
| `FIRECRAWL_SEED_URL` | Optional | Override default doc URL (falls back to connected shop domain) |
| `FIRECRAWL_SEED_INCLUDE_PATHS` | Optional | CSV list to scope Firecrawl |
| `FIRECRAWL_SEED_EXCLUDE_PATHS` | Optional | CSV list to omit from Firecrawl |
| `FIRECRAWL_SEED_MAX_PAGES` | Optional | Limit Firecrawl crawl depth |

## Frontend Consumption

- `apps/web/hooks/useAgent.ts` provides a React hook for thread/message interaction.
- Additional UI components under `apps/web/components/agent/*` render chat sidebar and message lists.
- Agent sidebar toggles exist in dashboard layout components.

## Future Notes

- Add new tools under `apps/backend/convex/agent/tools.ts`, then attach them via `createAgent()`.
- For RAG ingestion of other sources (Meta, Google Ads, etc.), follow the Shopify/Firecrawl patterns.
- To re-run Firecrawl for a customer, call `seedDocsFromFirecrawl` with `force: true`.
