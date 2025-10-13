import { v } from "convex/values";

import { createSimpleLogger } from "../../libs/logging/simple";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

// Type definitions for sync results
interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  platform: string;
  duration?: number;
  error?: string;
  errors?: string[];
  // Indicates whether any data changed during the sync
  dataChanged?: boolean;
  batchStats?: {
    batchesScheduled: number;
    ordersQueued: number;
    jobIds: string[];
  };
  productsProcessed?: number;
  customersProcessed?: number;
}

// Removed unused ScheduledSyncResult interface

const _logger = createSimpleLogger("SyncHandlers");

/**
 * Handle initial 60-day sync for a platform
 */
export const handleInitialSync = internalAction({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    accountId: v.optional(v.string()),
    syncType: v.optional(
      v.union(v.literal("initial"), v.literal("incremental")),
    ),
    dateRange: v.optional(
      v.object({
        daysBack: v.number(),
      }),
    ),
    syncSessionId: v.optional(v.id("syncSessions")),
    triggeredBy: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    recordsProcessed: v.number(),
    platform: v.string(),
    duration: v.optional(v.number()),
    error: v.optional(v.string()),
    errors: v.optional(v.array(v.string())),
    // Some platform syncs include this flag
    dataChanged: v.optional(v.boolean()),
    batchStats: v.optional(
      v.object({
        batchesScheduled: v.number(),
        ordersQueued: v.number(),
        jobIds: v.array(v.string()),
      }),
    ),
    productsProcessed: v.optional(v.number()),
    customersProcessed: v.optional(v.number()),
  }),
  handler: async (ctx, args): Promise<SyncResult> => {
    const startTime = Date.now();
    const syncType = (args.syncType ?? "initial") as "initial" | "incremental";

    console.log(
      `[INITIAL_SYNC] Starting ${args.platform} (${syncType}) sync for organization ${args.organizationId} - Fetching ${args.dateRange?.daysBack || 60} days of data`,
    );

    let sessionId: Id<"syncSessions"> | null = null;

    try {
      // Create or claim sync session
      const sessionResult = await ctx.runMutation(
        internal.jobs.helpers.createSyncSession,
        {
          organizationId: args.organizationId,
          platform: args.platform,
          type: syncType,
          sessionId: args.syncSessionId,
        },
      );

      sessionId = sessionResult.sessionId;

      if (sessionResult.alreadyRunning) {
        console.log(
          `[INITIAL_SYNC] Session ${sessionId} already running for ${args.platform} / ${args.organizationId}. Skipping duplicate job.`,
        );

        return {
          success: true,
          recordsProcessed: 0,
          platform: args.platform,
          duration: 0,
          dataChanged: false,
          batchStats: {
            batchesScheduled: 0,
            ordersQueued: 0,
            jobIds: [],
          },
          productsProcessed: 0,
          customersProcessed: 0,
        };
      }

      // Execute platform-specific initial sync
      let result: SyncResult;

      switch (args.platform) {
        case "shopify":
          result = (await ctx.runAction(
            internal.shopify.sync.initial,
            {
              organizationId: args.organizationId,
              dateRange: {
                daysBack: args.dateRange?.daysBack || 60,
              },
              syncSessionId: sessionId as Id<"syncSessions">,
            },
          )) as any;
          // Ensure platform field present
          result = { ...result, platform: args.platform };

          {
            const batchesScheduled = result.batchStats?.batchesScheduled ?? 0;
            const baseProcessed =
              (result.productsProcessed || 0) +
              (result.customersProcessed || 0);

            if (sessionId) {
              await ctx.runMutation(
                internal.jobs.helpers.initializeSyncSessionBatches,
                {
                  sessionId,
                  totalBatches: batchesScheduled,
                  initialRecordsProcessed: baseProcessed,
                  metrics: {
                    baselineRecords: baseProcessed,
                    ordersQueued: result.batchStats?.ordersQueued || 0,
                    productsProcessed: result.productsProcessed || 0,
                    customersProcessed: result.customersProcessed || 0,
                  },
                },
              );
            }

            if (sessionId) {
              const sessionUpdate: {
                sessionId: Id<"syncSessions">;
                status:
                  | "pending"
                  | "processing"
                  | "syncing"
                  | "completed"
                  | "failed"
                  | "cancelled";
                recordsProcessed: number;
                completedAt?: number;
                duration?: number;
              } = {
                sessionId,
                status: batchesScheduled > 0 ? "processing" : "completed",
                recordsProcessed:
                  batchesScheduled > 0
                    ? baseProcessed
                    : result.recordsProcessed || baseProcessed,
              };

              if (sessionUpdate.status === "completed") {
                sessionUpdate.completedAt = Date.now();
                sessionUpdate.duration = Date.now() - startTime;
              }

              await ctx.runMutation(
                internal.jobs.helpers.updateSyncSession,
                sessionUpdate,
              );

              if (sessionUpdate.status === "processing") {
                console.log(
                  `[INITIAL_SYNC] Queued ${batchesScheduled} Shopify order batches for organization ${args.organizationId}. Orders queued: ${result.batchStats?.ordersQueued ?? 0}.`,
                );
              }
            }
          }
          break;
        case "meta":
          result = (await ctx.runAction(
            internal.meta.sync.initial,
            {
              organizationId: args.organizationId,
              accountId: args.accountId,
              dateRange: {
                daysBack: args.dateRange?.daysBack || 60,
              },
            },
          )) as any;
          result = { ...result, platform: args.platform };
          break;

        default:
          throw new Error(`Unknown platform: ${args.platform}`);
      }

      if (args.platform !== "shopify") {
        await ctx.runMutation(internal.jobs.helpers.updateSyncSession, {
          sessionId: (sessionId ?? undefined) as Id<"syncSessions"> | undefined,
          status: result.success ? "completed" : "failed",
          recordsProcessed: result.recordsProcessed || 0,
          completedAt: Date.now(),
          duration: Date.now() - startTime,
          error: result.success ? undefined : result.error || result.errors?.[0],
        });
      }

      // Analytics calculation should be triggered separately after sync completes
      // This avoids circular dependencies between handlers

      const completionLabel =
        args.platform === "shopify" && result.batchStats?.batchesScheduled
          ? "queued"
          : "completed";

      console.log(
        `[INITIAL_SYNC] ✅ ${completionLabel} ${args.platform} sync for organization ${args.organizationId} - Processed ${result.recordsProcessed || 0} records in ${Math.round((Date.now() - startTime) / 1000)}s`,
      );

      try {
        await ctx.runMutation(
          internal.core.onboarding.triggerMonitorIfOnboardingComplete,
          {
            organizationId: args.organizationId,
            limit: 1,
            reason: `sync_${args.platform}_completed`,
          },
        );
      } catch (monitorError) {
        console.warn(
          `[INITIAL_SYNC] monitorInitialSyncs failed for ${args.platform} ${args.organizationId}`,
          monitorError,
        );
      }

      return result;
    } catch (error) {
      console.error(
        `[INITIAL_SYNC] ❌ Failed ${args.platform} sync for organization ${args.organizationId} after ${Math.round((Date.now() - startTime) / 1000)}s`,
        error,
      );

      // Update sync session with error
      await ctx.runMutation(internal.jobs.helpers.updateSyncSession, {
        sessionId: (sessionId ?? undefined) as Id<"syncSessions"> | undefined,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: Date.now(),
        duration: Date.now() - startTime,
      });

      try {
        await ctx.runMutation(
          internal.core.onboarding.triggerMonitorIfOnboardingComplete,
          {
            organizationId: args.organizationId,
            limit: 1,
            reason: `sync_${args.platform}_error`,
          },
        );
      } catch (monitorError) {
        console.warn(
          `[INITIAL_SYNC] monitorInitialSyncs failed after error for ${args.platform} ${args.organizationId}`,
          monitorError,
        );
      }

      throw error;
    }
  },
});

/**
 * Persist a Shopify order batch via workpool
 */
export const handleShopifyOrdersBatch = internalAction({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    syncSessionId: v.optional(v.id("syncSessions")),
    batchNumber: v.number(),
    cursor: v.optional(v.string()),
    orders: v.array(v.any()),
    transactions: v.optional(v.array(v.any())),
    refunds: v.optional(v.array(v.any())),
    fulfillments: v.optional(v.array(v.any())),
  },
  returns: v.object({
    success: v.boolean(),
    recordsProcessed: v.number(),
    duration: v.number(),
  }),
  handler: async (ctx, args) => {
    const start = Date.now();
    let analyticsEligibility: boolean | undefined;

    const ensureAnalyticsEligibility = async () => {
      if (analyticsEligibility === undefined) {
        analyticsEligibility = await ctx.runQuery(
          internal.shopify.status.getInitialSyncStatusInternal,
          {
            organizationId: args.organizationId,
          },
        );
      }

      return analyticsEligibility;
    };

    try {
      if (args.orders.length > 0) {
        await ctx.runMutation(internal.shopify.orderMutations.storeOrdersInternal, {
          organizationId: args.organizationId,
          storeId: args.storeId,
          orders: args.orders as any,
          shouldScheduleAnalytics: await ensureAnalyticsEligibility(),
        });
      }

      if (args.transactions && args.transactions.length > 0) {
        await ctx.runMutation(
          internal.shopify.orderMutations.storeTransactionsInternal,
          {
            organizationId: args.organizationId,
            transactions: args.transactions as any,
            shouldScheduleAnalytics: await ensureAnalyticsEligibility(),
          },
        );
      }

      if (args.refunds && args.refunds.length > 0) {
        await ctx.runMutation(internal.shopify.orderMutations.storeRefundsInternal, {
          organizationId: args.organizationId,
          refunds: args.refunds as any,
          shouldScheduleAnalytics: await ensureAnalyticsEligibility(),
        });
      }

      if (args.fulfillments && args.fulfillments.length > 0) {
        await ctx.runMutation(
          internal.shopify.orderMutations.storeFulfillmentsInternal,
          {
            organizationId: args.organizationId,
            fulfillments: args.fulfillments as any,
          },
        );
      }

      let progress: {
        totalBatches: number;
        previousCompleted: number;
        completedBatches: number;
        recordsProcessed: number;
        startedAt: number;
      } | null = null;

      if (args.syncSessionId) {
        progress = await ctx.runMutation(
          internal.jobs.helpers.incrementSyncSessionProgress,
          {
            sessionId: args.syncSessionId,
            batchesCompletedDelta: 1,
            recordsProcessedDelta: args.orders.length,
          },
        );

        if (
          progress &&
          progress.totalBatches > 0 &&
          progress.completedBatches >= progress.totalBatches
        ) {
          await ctx.runMutation(internal.jobs.helpers.patchSyncSessionMetadata, {
            sessionId: args.syncSessionId,
            metadata: {
              stageStatus: { orders: "completed" },
              syncedEntities: ["orders"],
            },
          });

          await ctx.runMutation(internal.jobs.helpers.updateSyncSession, {
            sessionId: args.syncSessionId,
            status: "completed",
            recordsProcessed: progress.recordsProcessed,
            completedAt: Date.now(),
            duration: Date.now() - (progress.startedAt || Date.now()),
          });

          await ctx.runMutation(internal.engine.syncJobs.onInitialSyncComplete, {
            workId: `shopifyOrdersBatch:${String(args.syncSessionId)}:${args.batchNumber}`,
            context: {
              organizationId: args.organizationId,
              platform: "shopify",
              sessionId: args.syncSessionId,
            },
            result: {
              recordsProcessed: progress.recordsProcessed,
            },
          });

          await ctx.runMutation(
            internal.core.onboarding.triggerMonitorIfOnboardingComplete,
            {
              organizationId: args.organizationId,
              limit: 1,
              reason: "shopify_orders_batch_complete",
            },
          );
        }
      }

      return {
        success: true,
        recordsProcessed: args.orders.length,
        duration: Date.now() - start,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BATCH] Batch ${args.batchNumber} failed for org ${args.organizationId}:`, errorMessage);

      if (args.syncSessionId) {
        // Still increment progress even on failure so session can eventually complete
        // This prevents one failed batch from blocking the entire sync
        const progress = await ctx.runMutation(
          internal.jobs.helpers.incrementSyncSessionProgress,
          {
            sessionId: args.syncSessionId,
            batchesCompletedDelta: 1, // Count as "completed" (even if failed)
            recordsProcessedDelta: 0,  // Don't count records since they failed
          },
        );

        console.error(`[BATCH] Updated progress despite failure: ${progress?.completedBatches}/${progress?.totalBatches} batches`);

        // If this was the last batch, mark stage as failed
        if (progress && progress.completedBatches >= progress.totalBatches) {
          await ctx.runMutation(internal.jobs.helpers.patchSyncSessionMetadata, {
            sessionId: args.syncSessionId,
            metadata: {
              stageStatus: { orders: "failed" },
              lastBatchError: errorMessage,
            } as any,
          });
          await ctx.runMutation(internal.jobs.helpers.updateSyncSession, {
            sessionId: args.syncSessionId,
            status: "failed",
            error: errorMessage,
            completedAt: Date.now(),
          });
        }
      }

      throw error; // Let workpool retry
    }
  },
});

/**
 * Handle scheduled incremental sync
 */
export const handleScheduledSync = internalAction({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.array(v.union(v.literal("shopify"), v.literal("meta"))),
    syncType: v.union(v.literal("initial"), v.literal("incremental")),
  },
  returns: v.object({
    success: v.boolean(),
    results: v.any(),
    // Include fields to satisfy broader consumers expecting SyncResult-like shapes
    platform: v.optional(v.string()),
    recordsProcessed: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<any> => {
    console.log(
      `[ScheduledSync] Starting for organization ${args.organizationId}`,
    );

    // Execute once for all platforms so orchestrator runs them together
    // and triggers analytics only once if any data changed.
    try {
      const execResult = await ctx.runAction(
        internal.engine.orchestrator.execute,
        {
          organizationId: args.organizationId,
          platforms: args.platforms,
          syncType: args.syncType,
        },
      );

      return {
        success: true,
        results: execResult?.results ?? [],
        platform: args.platforms[0] || "",
        recordsProcessed: Array.isArray(execResult?.results)
          ? execResult.results.reduce(
              (sum: number, r: any) => sum + (r?.recordsProcessed || 0),
              0,
            )
          : 0,
      } as any;
    } catch (error) {
      console.error(`[ScheduledSync] Failed`, error);
      return {
        success: false,
        results: [],
        platform: args.platforms[0] || "",
        recordsProcessed: 0,
        error: error instanceof Error ? error.message : String(error),
      } as any;
    }
  },
});

/**
 * Handle immediate user-triggered sync
 */
export const handleImmediateSync = internalAction({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.array(v.union(v.literal("shopify"), v.literal("meta"))),
    syncType: v.union(v.literal("initial"), v.literal("incremental")),
    triggeredBy: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    recordsProcessed: v.number(),
    platform: v.string(),
    duration: v.optional(v.number()),
    error: v.optional(v.string()),
    errors: v.optional(v.array(v.string())),
    dataChanged: v.optional(v.boolean()),
  }),
  handler: async (ctx, args): Promise<SyncResult> => {
    console.log(`[ImmediateSync] User-triggered`, {
      org: String(args.organizationId),
      by: args.triggeredBy,
    });

    // Execute sync with high priority
    const execResult: any = await ctx.runAction(
      internal.engine.orchestrator.execute as any,
      {
        organizationId: args.organizationId,
        platforms: args.platforms,
        syncType: args.syncType,
      },
    );

    // Analytics calculation should be triggered separately after sync completes
    // This avoids circular dependencies between handlers

    const success = Array.isArray(execResult?.results)
      ? execResult.results.every((r: any) => r?.success)
      : !!execResult?.success;
    const recordsProcessed = Array.isArray(execResult?.results)
      ? execResult.results.reduce(
          (sum: number, r: any) => sum + (r?.recordsProcessed || 0),
          0,
        )
      : 0;
    const duration =
      typeof execResult?.duration === "number"
        ? execResult.duration
        : undefined;
    const error = success
      ? undefined
      : Array.isArray(execResult?.results)
        ? execResult.results.find((r: any) => !r?.success)?.error
        : execResult?.error;

    return {
      success,
      recordsProcessed,
      platform: args.platforms[0] || "",
      duration,
      error,
    };
  },
});
