import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";

/**
 * Maintenance Background Jobs
 * Handles cleanup, error recovery, and system maintenance
 */

/**
 * Clean up old data
 */
export const cleanupOldData = internalAction({
  args: {
    daysToKeep: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    cleaned: v.object({
      auditLogs: v.number(),
      syncSessions: v.number(),
      // webhookLogs removed
      expiredCache: v.number(),
    }),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    const daysToKeep = args.daysToKeep || 90; // Default 90 days
    const cutoffDate = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    const results: {
      auditLogs: number;
      syncSessions: number;
      // webhookLogs removed
      expiredCache: number;
    } = {
      auditLogs: 0,
      syncSessions: 0,
      // webhookLogs removed
      expiredCache: 0,
    };

    // Fetch all old records in parallel for faster execution
    const syncCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const [oldAuditLogs, oldSyncSessions, expiredCache] = await Promise.all([
      ctx.runQuery(internal.jobs.maintenance.getOldRecords, {
        table: "auditLogs",
        cutoffDate,
        limit: 100,
      }),
      ctx.runQuery(internal.jobs.maintenance.getOldRecords, {
        table: "syncSessions",
        cutoffDate: syncCutoff,
        limit: 100,
      }),
      ctx.runQuery(internal.jobs.maintenance.getExpiredCache, {
        limit: 100,
      }),
    ]);

    // Delete audit logs
    for (const log of oldAuditLogs) {
      await ctx.runMutation(internal.jobs.maintenance.deleteRecord, {
        table: "auditLogs",
        id: log._id,
      });
      results.auditLogs++;
    }

    // Delete sync sessions
    for (const session of oldSyncSessions) {
      await ctx.runMutation(internal.jobs.maintenance.deleteRecord, {
        table: "syncSessions",
        id: session._id,
      });
      results.syncSessions++;
    }

    // Webhook logs removed

    // Delete expired cache
    // No realtime cache table to prune anymore.
    results.expiredCache += expiredCache.length;

    return {
      success: true,
      cleaned: results,
      timestamp: Date.now(),
    };
  },
});

/**
 * Handle sync failure
 */
export const handleSyncFailure = internalAction({
  args: {
    organizationId: v.id("organizations"),
    sessionId: v.optional(v.id("syncSessions")),
    error: v.optional(v.string()),
  },
  returns: v.object({
    sessionId: v.optional(v.id("syncSessions")),
    recentFailures: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ sessionId?: Id<"syncSessions">; recentFailures: number }> => {
    // Log the error only in critical cases

    // Update sync session if provided
    if (args.sessionId) {
      await ctx.runMutation(internal.jobs.maintenance.updateSyncSessionError, {
        sessionId: args.sessionId,
        error: args.error || "Unknown error",
      });
    }

    // Check if this is a recurring failure
    const recentFailures = await ctx.runQuery(
      internal.jobs.maintenance.getRecentSyncFailures,
      {
        organizationId: args.organizationId,
        hoursBack: 24,
      },
    );

    if (recentFailures.length >= 3) {
      // Too many failures, might need to alert or disable sync

      // Could create a support ticket here
      await ctx.runMutation(internal.jobs.maintenance.createSupportTicket, {
        organizationId: args.organizationId,
        type: "support",
        priority: "high",
        subject: "Multiple Sync Failures Detected",
        description: `Organization ${args.organizationId} has experienced ${recentFailures.length} sync failures in the last 24 hours. Latest error: ${args.error}`,
      });
    }

    return {
      sessionId: args.sessionId,
      recentFailures: recentFailures.length,
    };
  },
});

/**
 * Handle integration disconnection
 */
export const handleDisconnection = internalAction({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
  },
  returns: v.object({
    success: v.boolean(),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    organizationId: v.id("organizations"),
  }),
  handler: async (ctx, args) => {
    // Mark integration as inactive
    await ctx.runMutation(internal.jobs.maintenance.markIntegrationInactive, {
      organizationId: args.organizationId,
      platform: args.platform,
    });

    // Stop scheduled syncs for this platform
    await ctx.runMutation(internal.jobs.maintenance.pausePlatformSync, {
      organizationId: args.organizationId,
      platform: args.platform,
    });

    // Create notification for user
    // In a real app, this would send an email or in-app notification

    return {
      success: true,
      platform: args.platform,
      organizationId: args.organizationId,
    };
  },
});

/**
 * Clear cache for organization
 */
export const clearCache = internalAction({
  args: {
    organizationId: v.id("organizations"),
    cacheType: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    cleared: v.number(),
    cacheType: v.string(),
  }),
  handler: async (ctx, args) => {
    let cleared = 0;

    // Clear real-time metrics cache
    if (!args.cacheType || args.cacheType === "realtime") {
      const realtimeCache = await ctx.runQuery(
        internal.jobs.maintenance.getOrganizationCache,
        {
          organizationId: args.organizationId,
          table: "realtimeMetrics",
        },
      );

      for (const cache of realtimeCache) {
        await ctx.runMutation(internal.jobs.maintenance.deleteRecord, {
          table: "realtimeMetrics",
          id: cache._id,
        });
        cleared++;
      }
    }

    // Could add other cache types here

    return {
      success: true,
      cleared,
      cacheType: args.cacheType || "all",
    };
  },
});

/**
 * Reset sync credits (daily job)
 */
export const resetSyncCredits = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    reset: v.number(),
  }),
  handler: async (_ctx) => {
    return {
      success: true,
      reset: 0,
    };
  },
});

/**
 * Note: Webhook processing has been moved to workpool
 * Webhooks are now processed immediately via workpool instead of cron
 * This reduces latency and improves performance
 */

/**
 * Monitor webhook health
 */
export const monitorWebhookHealth = internalQuery({
  args: {},
  returns: v.object({
    total: v.number(),
    failureRate: v.number(),
    byStatus: v.object({
      processed: v.number(),
      failed: v.number(),
      pending: v.number(),
    }),
    healthCheck: v.string(),
    timestamp: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    total: number;
    failureRate: number;
    byStatus: { processed: number; failed: number; pending: number };
    healthCheck: string;
    timestamp: number;
  }> => {
    // Compute minimal webhook stats using receipts in last 24h
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const receiptsAll = await ctx.db.query("webhookReceipts").collect();
    const receipts = receiptsAll.filter((r) => r.processedAt >= since);
    const stats = {
      total: receipts.length,
      failureRate: 0,
      byStatus: { processed: receipts.length, failed: 0, pending: 0 },
    };

    // Check for high failure rate (no side-effects in query context)

    const byStatus = {
      processed:
        (stats.byStatus as any).processed ??
        (stats.byStatus as any).completed ??
        0,
      failed: (stats.byStatus as any).failed ?? 0,
      pending:
        (stats.byStatus as any).pending ??
        (stats.byStatus as any).received ??
        0,
    };

    return {
      total: stats.total,
      failureRate: stats.failureRate,
      byStatus,
      healthCheck: stats.failureRate <= 10 ? "healthy" : "unhealthy",
      timestamp: Date.now(),
    };
  },
});

/**
 * Check for expired trials and mark them as expired
 */
export const checkExpiredTrials = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    expired: v.number(),
    timestamp: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let expiredCount = 0;

    // Get all organizations with active trials
    const activeTrials = await ctx.runQuery(
      internal.jobs.maintenance.getActiveTrials,
    );

    // Checking active trials

    for (const org of activeTrials) {
      // Check if trial has expired
      if (org.trialEndDate && org.trialEndDate <= now) {
        await ctx.runMutation(internal.jobs.maintenance.expireTrial, {
          organizationId: org._id,
        });

        // Expired trial for organization

        expiredCount++;
      }
    }

    // Expired trials processed

    return {
      success: true,
      expired: expiredCount,
      timestamp: now,
    };
  },
});

// ============ QUERIES ============

/**
 * Get old records from a table
 */
export const getOldRecords = internalQuery({
  args: {
    table: v.string(),
    cutoffDate: v.number(),
    limit: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // TODO: Need indexes with createdAt field for better performance
    // Once indexes are added for each table, replace with proper index queries

    // Temporary: Get all records from table
    const allRecords = await (ctx.db.query as any)(args.table as any).collect();

    // Filter old records in memory
    return allRecords
      .filter((r: any) => r.createdAt && r.createdAt < args.cutoffDate)
      .slice(0, args.limit);
  },
});

/**
 * Get processed webhook logs
 */
// getProcessedWebhooks removed (webhook logs removed)

/**
 * Get expired cache entries
 */
export const getExpiredCache = internalQuery({
  args: {
    limit: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Realtime cache table removed; nothing to report.
    void ctx;
    void args;
    return [];
  },
});

/**
 * Get recent sync failures
 */
export const getRecentSyncFailures = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    hoursBack: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.hoursBack * 60 * 60 * 1000;

    // TODO: Need index "by_org_status_started" on syncSessions table
    // Once index is added, replace with:
    // const sessions = await ctx.db
    //   .query("syncSessions")
    //   .withIndex("by_org_status_started", (q) =>
    //     q.eq("organizationId", args.organizationId)
    //       .eq("status", "failed")
    //       .gte("startedAt", cutoff)
    //   )
    //   .collect();

    // Temporary: Get all sync sessions for organization
    const allSessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    // Filter failed sessions within time range in memory
    return allSessions.filter(
      (s) => s.status === "failed" && s.startedAt >= cutoff,
    );
  },
});

/**
 * Get organization cache
 */
export const getOrganizationCache = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    table: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Avoid invalid generic type lookups on dynamic tables by falling back
    // to a best-effort query without index hints when table name is dynamic.
    const query = (ctx.db.query as any)(args.table as any);
    try {
      // Try common by_organization index when available
      // If index missing, the call will throw; catch and fallback
      return await query
        .withIndex("by_organization" as any, (q: any) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();
    } catch {
      return await query.collect();
    }
  },
});

/**
 * Get profiles needing credit reset
 */
export const getProfilesNeedingCreditReset = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (_ctx) => {
    // TODO: Need index "by_credits_reset" on syncProfiles table
    // Once index is added, replace with:
    // const profiles = await ctx.db
    //   .query("syncProfiles")
    //   .withIndex("by_credits_reset", (q) => q.lte("creditsResetAt", now))
    //   .collect();

    // syncProfiles trimmed; no profiles to reset
    return [];
  },
});

/**
 * Get active trials that might need expiration check
 */
export const getActiveTrials = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      isTrialActive: v.optional(v.boolean()),
      hasTrialExpired: v.optional(v.boolean()),
      trialEndDate: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    // Get all organizations with active trials
    const allOrgs = await ctx.db.query("organizations").collect();

    return allOrgs
      .filter(
        (org) => org.isTrialActive && !org.hasTrialExpired && org.trialEndDate,
      )
      .map((org) => ({
        _id: org._id,
        isTrialActive: org.isTrialActive,
        hasTrialExpired: org.hasTrialExpired,
        trialEndDate: org.trialEndDate,
      }));
  },
});

// ============ MUTATIONS ============

/**
 * Delete a record
 */
export const deleteRecord = internalMutation({
  args: {
    table: v.string(),
    id: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Update sync session error
 */
export const updateSyncSessionError = internalMutation({
  args: {
    sessionId: v.id("syncSessions"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

/**
 * Create support ticket
 */
export const createSupportTicket = internalMutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.literal("system")),
    type: v.union(
      v.literal("sales"),
      v.literal("support"),
      v.literal("partnership"),
      v.literal("feedback"),
      v.literal("other"),
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    subject: v.string(),
    description: v.string(),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    // Tickets trimmed; store as a notification to Meyoo team
    const id = await ctx.db.insert("notifications", {
      title: `Support (${args.type}) - ${args.subject}`,
      message: args.description,
      type: "system",
      isRead: false,
      isSystem: true,
      createdAt: Date.now(),
    });
    return id as any;
  },
});

/**
 * Expire a trial for an organization
 */
export const expireTrial = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.organizationId, {
      isTrialActive: false,
      hasTrialExpired: true,
      updatedAt: Date.now(),
    });

    // Also update onboarding record to reset billing step
    const users = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const user of users) {
      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      if (onboarding) {
        // Mark billing as not completed so user must go through billing
        await ctx.db.patch(onboarding._id, {
          hasShopifySubscription: false,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

/**
 * Mark integration as inactive
 */
export const markIntegrationInactive = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.platform === "shopify") {
      const store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization_and_active", (q) =>
          q.eq("organizationId", args.organizationId).eq("isActive", true),
        )
        .first();

      if (store) {
        await ctx.db.patch(store._id, {
          isActive: false,
          uninstalledAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Update all users in the organization to reflect Shopify disconnection
        const users = await ctx.db
          .query("users")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId as Id<"organizations">),
          )
          .collect();

        for (const user of users) {
          // Update onboarding record instead of user
          const onboarding = await ctx.db
            .query("onboarding")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first();

          if (onboarding) {
            await ctx.db.patch(onboarding._id, {
              // Reset to behave like a new user
              onboardingStep: 1, // SHOPIFY step
              isCompleted: false,
              hasShopifyConnection: false,
              hasShopifySubscription: false,
              isProductCostSetup: false,
              isExtraCostSetup: false,
              isInitialSyncComplete: false,
              updatedAt: Date.now(),
            } as any);
          }

          await ctx.db.patch(user._id, {
            updatedAt: Date.now(),
          });
        }
      }
    } else {
      const session = await ctx.db
        .query("integrationSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("platform", args.platform as "shopify" | "meta")
            .eq("isActive", true),
        )
        .first();

      if (session) {
        await ctx.db.patch(session._id, {
          isActive: false,
          updatedAt: Date.now(),
        });

        // Update users for other platform disconnections
        if (args.platform === "meta") {
          const onboardingRecords = await ctx.db
            .query("onboarding")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();

          for (const record of onboardingRecords) {
            await ctx.db.patch(record._id, {
              hasMetaConnection: false,
              updatedAt: Date.now(),
            });
          }
        }
      }
    }
  },
});

/**
 * Pause platform sync
 */
export const pausePlatformSync = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.string(),
  },
  returns: v.null(),
  handler: async () => {
    // No-op; syncProfiles trimmed
  },
});

/**
 * Reset profile credits
 */
export const resetProfileCredits = internalMutation({
  args: {
    profileId: v.string(),
  },
  returns: v.null(),
  handler: async () => {
    // No-op; syncProfiles trimmed
  },
});
