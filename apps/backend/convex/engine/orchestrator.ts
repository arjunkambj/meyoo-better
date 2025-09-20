import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";

/**
 * Rate limiting configuration per platform
 */
const RATE_LIMITS = {
  shopify: { requests: 40, window: 1000 }, // 40 req/sec
  meta: { requests: 200, window: 3600000 }, // 200 req/hour
} as const;

/**
 * Track rate limit usage
 */
const rateLimitTracker: Record<string, { count: number; resetAt: number }> = {};

/**
 * Main sync orchestrator - coordinates all platform syncs
 */
export const execute = internalAction({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.array(v.string()),
    syncType: v.union(v.literal("initial"), v.literal("incremental")),
    dateRange: v.optional(
      v.object({
        daysBack: v.optional(v.number()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    results: v.array(
      v.object({
        platform: v.string(),
        success: v.boolean(),
        recordsProcessed: v.optional(v.number()),
        error: v.optional(v.string()),
        duration: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const _startTime = Date.now();
    const results = [];

    // Execute syncs in parallel with rate limiting
    const syncPromises = args.platforms.map(async (platform) => {
      const platformStart = Date.now();

      try {
        // Check rate limits
        if (!checkRateLimit(platform)) {
          throw new Error(`Rate limit exceeded for ${platform}`);
        }

        // Log sync start (per org+platform lock)
        const { sessionId: syncId, alreadyRunning } = await ctx.runMutation(
          internal.engine.orchestrator.logSyncStart,
          {
            organizationId: args.organizationId,
            platform: platform as "shopify" | "meta",
            syncType: args.syncType,
          },
        );

        // If another worker/request is already syncing this org+platform, skip heavy work
        if (alreadyRunning) {
          return {
            platform,
            success: true,
            recordsProcessed: 0,
            duration: Date.now() - platformStart,
          };
        }

        // Execute platform-specific sync
        interface SyncResult {
          recordsProcessed: number;
          dataChanged: boolean;
        }
        let result: SyncResult;

        switch (platform) {
          case "shopify":
            result = await executeShopifySync(ctx, args);
            break;
          case "meta":
            result = await executeMetaSync(ctx, args);
            break;

          default:
            throw new Error(`Unknown platform: ${platform}`);
        }

        // Log sync completion
        await ctx.runMutation(internal.engine.orchestrator.logSyncComplete, {
          syncId,
          success: true,
          recordsProcessed: result.recordsProcessed,
          dataChanged: result.dataChanged,
          duration: Date.now() - platformStart,
        });

        // Update sync metrics in profiler
        await ctx.runMutation(internal.engine.profiler.updateSyncMetrics, {
          organizationId: args.organizationId,
          duration: Date.now() - platformStart,
          dataChanged: result.dataChanged,
          success: true,
        });

        return {
          platform,
          success: true,
          recordsProcessed: result.recordsProcessed,
          duration: Date.now() - platformStart,
        };
      } catch (error: unknown) {
        // Log sync failure
        await ctx.runMutation(internal.engine.orchestrator.logSyncComplete, {
          syncId: "", // We might not have syncId if logSyncStart failed
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - platformStart,
        });

        // Update sync metrics
        await ctx.runMutation(internal.engine.profiler.updateSyncMetrics, {
          organizationId: args.organizationId,
          duration: Date.now() - platformStart,
          dataChanged: false,
          success: false,
        });

        return {
          platform,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - platformStart,
        };
      }
    });

    // Wait for all syncs to complete
    const syncResults = await Promise.allSettled(syncPromises);

    // Process results
    for (const result of syncResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          platform: "unknown",
          success: false,
          error: result.reason,
          duration: 0,
        });
      }
    }

    // Trigger analytics calculation if any data changed
    const hasChanges = results.some((r) => r.success);

    if (hasChanges) {
      await ctx.runAction(internal.engine.analytics.calculateAnalytics, {
        organizationId: args.organizationId,
        dateRange: args.dateRange,
      });
    }

    // Schedule next sync
    await ctx.runMutation(internal.engine.scheduler.scheduleNext, {
      organizationId: args.organizationId,
      platforms: args.platforms.filter((p) => p === "shopify" || p === "meta"),
    });

    return {
      success: results.every((r) => r.success),
      results,
    };
  },
});

interface SyncArgs {
  organizationId: Id<"organizations">;
  syncType: "initial" | "incremental";
  dateRange?: {
    daysBack?: number;
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Execute Shopify sync
 */
async function executeShopifySync(
  ctx: GenericActionCtx<DataModel>,
  args: SyncArgs,
) {
  // Import Shopify integration dynamically
  const { shopify } = await import("../integrations/shopify");

  if (args.syncType === "initial") {
    return await shopify.sync.initial(ctx, {
      organizationId: args.organizationId,
      dateRange: args.dateRange,
    });
  } else {
    return await shopify.sync.incremental(ctx, {
      organizationId: args.organizationId,
    });
  }
}

/**
 * Execute Meta sync
 */
async function executeMetaSync(
  ctx: GenericActionCtx<DataModel>,
  args: SyncArgs,
) {
  // Use the production Meta sync pipeline backed by MetaAPIClient
  if (args.syncType === "initial") {
    const res = await ctx.runAction(
      internal.integrations.metaSync.initial,
      {
        organizationId: String(args.organizationId),
        dateRange: args.dateRange?.daysBack
          ? { daysBack: args.dateRange.daysBack }
          : undefined,
      },
    );
    return {
      recordsProcessed: res.recordsProcessed || 0,
      dataChanged: Boolean(res.dataChanged),
    };
  } else {
    const res = await ctx.runAction(
      internal.integrations.metaSync.incremental,
      {
        organizationId: String(args.organizationId),
        since: args.dateRange?.startDate
          ? Date.parse(args.dateRange.startDate)
          : undefined,
      },
    );
    return {
      recordsProcessed: res.recordsProcessed || 0,
      dataChanged: Boolean(res.dataChanged),
    };
  }
}

// Google integration removed temporarily

/**
 * Log sync start
 */
export const logSyncStart = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    syncType: v.string(),
  },
  returns: v.object({
    sessionId: v.id("syncSessions"),
    alreadyRunning: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Guard: if a sync is already running for this org+platform, reuse it
    const existing = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("platform", args.platform)
          .eq("status", "syncing"),
      )
      .first();

    if (existing) {
      return { sessionId: existing._id, alreadyRunning: true };
    }

    const sessionId = await ctx.db.insert("syncSessions", {
      organizationId: args.organizationId,
      platform: args.platform,
      type: args.syncType,
      status: "syncing",
      startedAt: Date.now(),
    });

    return { sessionId, alreadyRunning: false };
  },
});

/**
 * Log sync completion
 */
export const logSyncComplete = internalMutation({
  args: {
    syncId: v.union(v.id("syncSessions"), v.literal("")),
    success: v.boolean(),
    recordsProcessed: v.optional(v.number()),
    dataChanged: v.optional(v.boolean()),
    error: v.optional(v.string()),
    duration: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.syncId || args.syncId === "") return;

    // Update sync session status
    const syncSession = await ctx.db.get(args.syncId);

    if (!syncSession) return;

    await ctx.db.patch(args.syncId, {
      completedAt: Date.now(),
      status: args.success ? "completed" : "failed",
      recordsProcessed: args.recordsProcessed || 0,
      error: args.error,
    });

    // Check if this is the first successful sync for the organization
    if (args.success && syncSession.organizationId) {
      // Get the user for this organization
      const user = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", syncSession.organizationId),
        )
        .first();

      // If user exists, check onboarding status for initial sync completion
      if (!user) return;

      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user_organization", (q) =>
          q
            .eq("userId", user._id)
            .eq("organizationId", syncSession.organizationId),
        )
        .first();

      if (user && onboarding && !onboarding.isInitialSyncComplete) {
        // Check if at least one successful sync has completed
        const successfulSyncs = await ctx.db
          .query("syncSessions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", syncSession.organizationId),
          )
          .filter((q) => q.eq(q.field("status"), "completed"))
          .take(1);

        if (successfulSyncs.length > 0) {
          // Update onboarding record instead of user
          await ctx.db.patch(onboarding._id, {
            isInitialSyncComplete: true,
            updatedAt: Date.now(),
          });
          // production: avoid PII in logs
        }
      }
    }
  },
});

/**
 * Check rate limits for a platform
 */
function checkRateLimit(platform: string): boolean {
  const limits = RATE_LIMITS[platform as keyof typeof RATE_LIMITS];

  if (!limits) return true; // No limits defined

  const now = Date.now();
  const tracker = rateLimitTracker[platform];

  if (!tracker || now > tracker.resetAt) {
    // Reset tracker
    rateLimitTracker[platform] = {
      count: 1,
      resetAt: now + limits.window,
    };

    return true;
  }

  if (tracker.count >= limits.requests) {
    return false; // Rate limit exceeded
  }

  tracker.count++;

  return true;
}

/**
 * Batch sync for multiple organizations (used by scheduled jobs)
 */
export const batchExecute = internalAction({
  args: {
    organizations: v.array(
      v.object({
        organizationId: v.id("organizations"),
        platforms: v.array(v.string()),
      }),
    ),
  },
  returns: v.object({
    total: v.number(),
    successful: v.number(),
    failed: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> => {
    interface ExecuteResult {
      success: boolean;
      results: Array<{
        platform: string;
        success: boolean;
        recordsProcessed?: number;
        error?: string;
        duration: number;
      }>;
    }
    const results: PromiseSettledResult<ExecuteResult>[] = [];

    // Process organizations in batches to avoid overwhelming the system
    const batchSize = 5;

    for (let i = 0; i < args.organizations.length; i += batchSize) {
      const batch = args.organizations.slice(i, i + batchSize);

      const batchPromises: Promise<ExecuteResult>[] = batch.map((org) =>
        ctx.runAction(internal.engine.orchestrator.execute, {
          organizationId: org.organizationId,
          platforms: org.platforms,
          syncType: "incremental",
        }),
      );

      const batchResults: PromiseSettledResult<ExecuteResult>[] =
        await Promise.allSettled(batchPromises);

      results.push(...batchResults);

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      total: args.organizations.length,
      successful: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  },
});

/**
 * Get sync status for an organization
 */
export const getSyncStatus = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    isRunning: v.boolean(),
    lastSync: v.optional(
      v.object({
        platform: v.string(),
        completedAt: v.number(),
        status: v.string(),
      }),
    ),
    nextSync: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Check for running syncs
    const allSyncs = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const runningSyncs = allSyncs.filter((sync) => sync.status === "syncing");

    // Get last completed sync
    const completedSyncs = allSyncs
      .filter((sync) => sync.status !== "syncing")
      .sort(
        (a, b) =>
          (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt),
      );

    const lastSync = completedSyncs[0];

    // Get next sync time from profile
    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    return {
      isRunning: runningSyncs.length > 0,
      lastSync: lastSync
        ? {
            platform: lastSync.platform,
            completedAt: lastSync.completedAt || lastSync.startedAt,
            status: lastSync.status,
          }
        : undefined,
      nextSync: profile?.nextScheduledSync,
    };
  },
});
