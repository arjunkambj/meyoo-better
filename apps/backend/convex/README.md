Convex backend layout

- core — shared domain logic (users, orgs, onboarding, costs, usage)
- engine — scheduling, analytics, events, rate limiting, workpool jobs
- integrations — Shopify/Meta/Google adapters and storage pipelines
- jobs — background actions and helpers triggered via workpool/cron
- schema — table definitions and indexes (referenced in schema.ts)
- web — public APIs for the storefront dashboard (customer-facing)
- meyoo — admin APIs used by the Meyoo backoffice
- webhooks — HTTP handlers for Shopify + GDPR
- sync — HTTP endpoints for sync triggers (manual sync disabled)
- _generated — convex generated types (do not edit)

Conventions

- Public functions: query/mutation/action in web/ and meyoo/
- Internal functions: internalQuery/internalMutation/internalAction elsewhere
- External IO only in actions/httpAction; db reads/writes in queries/mutations
- All collections queried with indexes; prefer take/paginate over full collect
- Background work goes through @convex-dev/workpool (see engine/workpool.ts)

HTTP + Crons

- HTTP routes are registered in http.ts (auth + shopify + gdpr + sync)
- Crons in crons.ts perform periodic maintenance and token refresh

Notes

- Webhook payload bodies are not stored; lightweight idempotent receipts are
- Use getAuthUserId(ctx) for auth in public APIs
- See ../../rules_convex.md for detailed patterns and examples
