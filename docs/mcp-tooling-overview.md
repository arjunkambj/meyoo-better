# MCP Tooling Overview

This guide consolidates the agent documentation into a single reference covering:
- which MCP tools are exposed,
- how authentication works for the MCP server,
- how data flows from Convex into those tools.

## MCP Server Entry Points

- **HTTP transport**: `/api/[transport]` handled by `apps/web/app/api/[transport]/route.ts`.
- **OAuth metadata**: `/.well-known/oauth-protected-resource` handled by `apps/web/app/.well-known/oauth-protected-resource/route.ts`.

Both routes are powered by `mcp-handler`.

### Authentication Flow
1. MCP clients send `Authorization: Bearer <Meyoo API key>` with each request (tools keep an optional `apiKey` argument for backwards compatibility).
2. `withMcpAuth` calls the Convex query `api.web.security.validateApiKey`, which now returns:
   - `userId` and `organizationId` for the key owner,
   - a lightweight organization profile (`name`, `timezone`, `locale`, `isPremium`, `trialEndDate`).
3. The validated context is attached to `extra.authInfo` so tools can personalize responses without more queries.
4. `internal.agent.mcpActions.updateApiKeyUsage` increments usage metrics on every successful call.

If the key is revoked, unknown, or linked to a missing organization, the request is rejected before any tool runs.

### OAuth Metadata Endpoint
- By default the metadata lists `MCP_AUTH_SERVER_URL` (or `NEXT_PUBLIC_APP_URL + /api/auth` if unset) so clients know which issuer to use.
- OPTIONS requests return the CORS handler from `metadataCorsOptionsRequestHandler()`.

## Available Tools

The current toolset is defined in `apps/web/app/api/[transport]/route.ts` and backed by Convex actions in `apps/backend/convex/agent/mcpActions.ts`:

| Tool | Purpose | Backend action | Notes |
| ---- | ------- | -------------- | ----- |
| `orders_summary` | Summaries order volumes, fulfillment states, and revenue KPIs. | `api.agent.mcpActions.ordersSummary` | Wraps `api.web.orders.getOrdersOverview` with optional date filters. |
| `inventory_low_stock` | Surfaces critical/low stock alerts for replenishment. | `api.agent.mcpActions.inventoryLowStock` | Uses `api.web.inventory.getStockAlerts` and filters out overstock results. |
| `analytics_summary` | Summaries store metrics over a date range (daily/weekly/monthly). | `api.agent.mcpActions.analyticsSummary` | Aggregates totals from `api.web.analytics.getMetrics`; supports optional metric filter list. |
| `meta_ads_overview` | Meta ads performance window (impressions, CTR, CAC, conversions). | `api.agent.mcpActions.metaAdsOverview` | Wraps `api.web.analytics.getPlatformMetrics` and formats KPIs for dashboards. |
| `current_date` | Returns canonical UTC date/time strings. | `api.agent.mcpActions.getCurrentDate` | Keeps agent responses anchored to the current day. |
| `brand_summary` | Fetches the latest RAG-stored overview of the merchant brand. | `api.agent.mcpActions.getBrandSummary` | Reads from the org-specific namespace populated by onboarding jobs. |
| `pnl_snapshot` | Provides revenue, profit, and margin snapshot for a period. | `api.agent.mcpActions.pnlSnapshot` | Relies on `api.web.pnl.getMetrics` for daily aggregates. |

All tool schemas keep an optional `apiKey` string, but when a bearer token is present the helper `resolveApiToken` ignores the argument so requests stay consistent.

## Data Flow Snapshot

1. **Client → Next.js**: an MCP client issues a request to `/api/[transport]`, authenticated with a Meyoo API key.
2. **Next.js → Convex**: the handler validates the key, resolves the org, and forwards the request to the relevant Convex action.
3. **Convex Actions**: each action runs domain-specific queries/mutations:
   - `ordersSummary` → orders overview metrics
   - `inventoryLowStock` → inventory alert query
   - `analyticsSummary` / `metaAdsOverview` → analytics queries
   - `getCurrentDate` → Convex action generating canonical timestamps
   - `pnlSnapshot` → profit & loss metrics aggregation
   - `getBrandSummary` → RAG lookup via `internal.agent.mcpQueries.getBrandSummaryForOrg`
4. **Convex → Next.js**: the action returns structured data; the handler formats it into MCP-friendly text content.
5. **Next.js → Client**: response delivered via MCP transport; errors bubble up with `isError: true` payloads.

## Environment Requirements

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_CONVEX_URL` | Required to connect the `ConvexHttpClient` inside the MCP handler. |
| `REDIS_URL` (optional) | Enables Redis-based session storage for MCP handler. |
| `MCP_AUTH_SERVER_URL` (optional) | Explicit issuer URL for OAuth metadata; defaults to `${NEXT_PUBLIC_APP_URL}/api/auth`. |
| `NEXT_PUBLIC_APP_URL` (optional) | Used as fallback issuer when the explicit URL is not provided. |
| Convex env vars | (e.g., Shopify/Auth keys) — unchanged; tools rely on existing Convex integrations. |

Keep the documentation in this file up to date whenever tools or authentication flows change.
