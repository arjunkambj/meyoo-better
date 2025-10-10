import { v } from "convex/values";
import { internal } from "../_generated/api";
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

    for (const record of activeTrials) {
      // Check if trial has expired
      if (record.trialEndDate && record.trialEndDate <= now) {
        await ctx.runMutation(internal.jobs.maintenance.expireTrial, {
          organizationId: record.organizationId,
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
    const { table, cutoffDate, limit } = args;

    if (table === "auditLogs") {
      return await ctx.db
        .query("auditLogs")
        .withIndex("by_created", (q) => q.lt("createdAt", cutoffDate))
        .order("asc")
        .take(limit);
    }

    if (table === "syncSessions") {
      return await ctx.db
        .query("syncSessions")
        .withIndex("by_started_at", (q) => q.lt("startedAt", cutoffDate))
        .order("asc")
        .take(limit);
    }

    const genericQuery = (ctx.db.query as any)(table as any);
    const allRecords = await genericQuery.collect();

    return allRecords
      .filter((r: any) => r.createdAt && r.createdAt < cutoffDate)
      .slice(0, limit);
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
 * Get active trials that might need expiration check
 */
export const getActiveTrials = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("billing"),
      organizationId: v.id("organizations"),
      isTrialActive: v.optional(v.boolean()),
      hasTrialExpired: v.optional(v.boolean()),
      trialEndDate: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const billingRecords = await ctx.db.query("billing").collect();

    return billingRecords
      .filter((billing) => billing.isTrialActive && !billing.hasTrialExpired)
      .filter((billing) => billing.trialEndDate || billing.trialEndsAt)
      .map((billing) => ({
        _id: billing._id,
        organizationId: billing.organizationId,
        isTrialActive: billing.isTrialActive,
        hasTrialExpired: billing.hasTrialExpired,
        trialEndDate: billing.trialEndDate ?? billing.trialEndsAt,
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
 * Expire a trial for an organization
 */
export const expireTrial = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (billing) {
      await ctx.db.patch(billing._id, {
        isTrialActive: false,
        hasTrialExpired: true,
        updatedAt: Date.now(),
      });
    }

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
