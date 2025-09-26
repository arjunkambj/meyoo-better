# Shopify Sync Overhaul Plan

## Problem Definition

1. **Duplicate Initial Sync Scheduling**  
   - Repeated user clicks (billing/onboarding) trigger fresh `sync:initial` jobs even when one is already running.  
   - Expected outcome: the platform should have at most one active initial sync per org/platform; new requests must reuse existing sessions and simply report progress.  
   - Verification: multiple rapid triggers return the same session id and no extra jobs appear in Convex logs.

2. **Legacy vs. New Pipeline Conflict**  
   - Onboarding runs `shopifySync.initial`, while orchestrator/scheduler still use the legacy integration. Both pipelines process the same store, doubling work and causing write conflicts.  
   - Expected outcome: only the new `shopifySync` pipeline remains, used everywhere.  
   - Verification: orchestrator scheduling shows a single action path; the legacy integration entry points are removed.

3. **Write Conflicts During Sync/Webhooks**  
   - Small batches and per-record lookups cause Convex OCC failures when webhook processors and sync batches overlap.  
   - Expected outcome: shared idempotent upsert helpers with retry, and larger indexed batches eliminate write conflicts under concurrent load.  
   - Verification: load test with overlapping webhook + batch writes completes without Convex write conflict errors.

4. **No Incremental Sync / Poor Recovery**  
   - After initial sync, there is no robust incremental pipeline; failed runs block recovery.  
   - Expected outcome: incremental sync driven by `lastSyncedAt`, and install/onboarding only skip when a completed session exists.  
   - Verification: re-running incremental sync pulls only new/updated records; failed initial attempts can be retriggered cleanly.

## Phase 1 · Guard & Deduplicate Job Scheduling (Root Fix)
- [x] Introduce `ensureInitialSync` internal mutation that checks existing sessions and only enqueues when none are active
- [x] Update Shopify OAuth callback, billing flow, and install provisioning to call `ensureInitialSync`
- [x] Update `handleInitialSync` to respect reserved session ids and exit early if another worker owns the run
- [x] Record session telemetry (status transitions, start/end timestamps) to confirm dedupe works
- [ ] **Verify:** rapid onboarding/billing triggers reuse the same session (no duplicate jobs)

## Phase 2 · Fix Install & Recovery Logic (Root Fix Continuation)
- [x] Treat only `status === "completed"` sessions as "already synced" during install/onboarding checks
- [x] Ensure failed initial syncs automatically retry when the user reconnects (no admin utility)
- [x] Update onboarding UI queries to surface accurate sync status without creating new jobs
- [ ] **Verify:** simulate failed initial sync, reconnect store, confirm exactly one new sync is enqueued and completes

## Phase 3 · Consolidate Pipelines & Add Incremental Sync
- [x] Route orchestrator/scheduler to `shopifySync.initial` / `.incremental` exclusively
- [x] Implement `shopifySync.incremental` with `lastSyncedAt` per store and date cursor query
- [x] Remove legacy Shopify integration sync code paths
- [ ] **Verify:** run scheduled incremental sync, confirm only delta records are processed and no legacy code paths run

## Phase 4 · Harden Persistence & Webhooks
- [ ] Create shared upsert helpers with retry-on-conflict for orders/customers/line items/transactions
- [ ] Increase batch sizes and rely on indexed bulk reads to reduce Convex load
- [ ] Update webhook handlers to use the shared upsert logic and never enqueue initial syncs
- [ ] Verification Steps: stress test with simultaneous sync + webhook traffic; ensure zero write conflicts and correct data counts

## Phase 5 · Scaling & Analytics Safety
- [ ] Move historical pulls to Shopify Bulk Operations for high-volume stores
- [ ] Gate analytics/marketing jobs on sync telemetry and enforce per-org concurrency caps
- [ ] Add dashboards/alerts for sync throughput, failure rate, and webhook latency
- [ ] Verification Steps: backfill large store (20k orders) successfully; analytics runs only after dataChanged = true
