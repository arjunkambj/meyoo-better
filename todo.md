# Convex Cleanup TODO

Refactor unused/legacy Convex functions in batches of three files. After completing each batch, run `bun run lint` and `bun run check-types` before moving to the next batch.

## Batch 1
- [x] Trim unused exports in `apps/backend/convex/agent/firecrawl.ts`
- [x] Trim unused exports in `apps/backend/convex/billing/organizationHelpers.ts`
- [x] Trim unused exports in `apps/backend/convex/billing/trackUsage.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 2
- [x] Trim unused exports in `apps/backend/convex/core/costs.ts`
- [x] Trim unused exports in `apps/backend/convex/core/memberships.ts`
- [x] Trim unused exports in `apps/backend/convex/core/onboarding.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 3
- [x] Trim unused exports in `apps/backend/convex/core/organizationLookup.ts`
- [x] Trim unused exports in `apps/backend/convex/core/organizations.ts`
- [x] Trim unused exports in `apps/backend/convex/core/shopDomainHelper.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 4
- [x] Trim unused exports in `apps/backend/convex/core/teams.ts`
- [x] Verify `apps/backend/convex/core/time.ts` usage (`getShopTimeInfo` kept)
- [x] Trim unused exports in `apps/backend/convex/core/usage.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 5
- [x] Trim unused exports in `apps/backend/convex/core/users.ts`
- [x] Trim unused exports in `apps/backend/convex/engine/events.ts`
- [x] Trim unused exports in `apps/backend/convex/engine/health.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 6
- [x] Trim unused exports in `apps/backend/convex/engine/optimizer.ts`
- [x] Trim unused exports in `apps/backend/convex/engine/orchestrator.ts`
- [x] Trim unused exports in `apps/backend/convex/engine/scheduler.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 7
- [x] Trim unused exports in `apps/backend/convex/engine/syncJobs.ts`
- [x] Trim unused exports in `apps/backend/convex/integrations/meta.ts`
- [x] Trim unused exports in `apps/backend/convex/integrations/metaInternal.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 8
- [x] Trim unused exports in `apps/backend/convex/integrations/metaSync.ts`
- [x] Trim unused exports in `apps/backend/convex/integrations/shopify.ts`
- [x] Trim unused exports in `apps/backend/convex/integrations/shopifySync.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 9
- [x] Trim unused exports in `apps/backend/convex/jobs/maintenance.ts`
- [x] Trim unused exports in `apps/backend/convex/jobs/maintenanceHandlers.ts`
- [x] Trim unused exports in `apps/backend/convex/meyoo/admin.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 10
- [x] Trim unused exports in `apps/backend/convex/web/analytics.ts`
- [x] Trim unused exports in `apps/backend/convex/web/customers.ts`
- [x] Trim unused exports in `apps/backend/convex/web/dashboard.ts`
- [x] `bun run lint` & `bun run check-types`

## Batch 11
- [ ] Trim unused exports in `apps/backend/convex/web/integrationRequests.ts`
- [ ] Trim unused exports in `apps/backend/convex/web/inventory.ts`
- [ ] Trim unused exports in `apps/backend/convex/web/orders.ts`
- [ ] `bun run lint` & `bun run check-types`

## Batch 12
- [ ] Trim unused exports in `apps/backend/convex/web/pnl.ts`
- [ ] Trim unused exports in `apps/backend/convex/web/security.ts`
- [ ] Trim unused exports in `apps/backend/convex/web/sync.ts`
- [ ] `bun run lint` & `bun run check-types`
