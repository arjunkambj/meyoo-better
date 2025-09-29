import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

type SyncPlatform = "shopify" | "meta";
type SyncStatus =
  | "pending"
  | "processing"
  | "syncing"
  | "completed"
  | "failed"
  | "cancelled";

function isSyncPlatform(value: string): value is SyncPlatform {
  return value === "shopify" || value === "meta";
}

function isSyncStatus(value: string): value is SyncStatus {
  switch (value) {
    case "pending":
    case "processing":
    case "syncing":
    case "completed":
    case "failed":
    case "cancelled":
      return true;
    default:
      return false;
  }
}

/**
 * Sync Control API
 * Manages manual sync triggers and monitoring
 */

// Manual sync mutation removed — syncs are entirely automatic now.

/**
 * Get active sync sessions
 */
export const getActiveSyncSessions = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("syncSessions"),
      platform: v.string(),
      status: v.string(),
      progress: v.optional(v.number()),
      startedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    const ACTIVE_STATUSES = ["pending", "processing", "syncing"] as const;
    const PER_STATUS_LIMIT = 25;

    const sessionGroups = await Promise.all(
      ACTIVE_STATUSES.map((status) =>
        ctx.db
          .query("syncSessions")
          .withIndex("by_org_status_and_startedAt", (q) =>
            q
              .eq("organizationId", auth.orgId as Id<"organizations">)
              .eq("status", status),
          )
          .order("desc")
          .take(PER_STATUS_LIMIT),
      ),
    );

    const sessions = sessionGroups
      .flat()
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, 50);

    return sessions.map((session) => ({
      id: session._id,
      platform: session.platform,
      status: session.status,
      progress: session.recordsProcessed || 0,
      startedAt: session.startedAt,
    }));
  },
});

/**
 * Get sync sessions
 */
export const getSyncSessions = query({
  args: {
    limit: v.optional(v.number()),
    platform: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      id: v.id("syncSessions"),
      platform: v.string(),
      syncType: v.string(),
      status: v.string(),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      recordsProcessed: v.number(),
      errorMessage: v.optional(v.string()),
      isManual: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    const orgId = auth.orgId as Id<"organizations">;
    const MAX_LIMIT = 200;
    const DEFAULT_LIMIT = 50;
    const limit = args.limit && args.limit > 0
      ? Math.min(Math.floor(args.limit), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const platformFilter =
      args.platform && typeof args.platform === "string" && isSyncPlatform(args.platform)
        ? args.platform
        : undefined;
    const statusFilter =
      args.status && typeof args.status === "string" && isSyncStatus(args.status)
        ? args.status
        : undefined;

    let sessions: Array<Doc<"syncSessions">> = [];

    if (platformFilter && statusFilter) {
      sessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_status_and_startedAt", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("platform", platformFilter)
            .eq("status", statusFilter),
        )
        .order("desc")
        .take(limit);
    } else if (platformFilter) {
      sessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_date", (q) =>
          q.eq("organizationId", orgId).eq("platform", platformFilter),
        )
        .order("desc")
        .take(limit);
    } else if (statusFilter) {
      sessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_status_and_startedAt", (q) =>
          q.eq("organizationId", orgId).eq("status", statusFilter),
        )
        .order("desc")
        .take(limit);
    } else {
      sessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_and_startedAt", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .take(limit);
    }

    const limited = sessions.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    return limited.map((session) => ({
      id: session._id,
      platform: session.platform,
      syncType: session.type || "incremental",
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      recordsProcessed: session.recordsProcessed || 0,
      errorMessage: session.error,
      isManual: false,
    }));
  },
});

/**
 * Check if an account has been synced recently
 */
export const checkAccountSyncStatus = query({
  args: {
    platform: v.literal("meta"),
    accountId: v.string(),
  },
  returns: v.object({
    hasSyncedData: v.boolean(),
    lastSyncedAt: v.union(v.null(), v.number()),
    dataCount: v.number(),
    isStale: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return { hasSyncedData: false, lastSyncedAt: null, dataCount: 0, isStale: true };
    }

    // Check based on platform
    if (args.platform === "meta") {
      // Check if Meta account exists and has been synced
      const metaAccount = await ctx.db
        .query("metaAdAccounts")
        .withIndex("by_account_org", (q) =>
          q
            .eq("accountId", args.accountId)
            .eq("organizationId", auth.orgId as Id<"organizations">),
        )
        .first();

      if (!metaAccount) {
        return {
          hasSyncedData: false,
          lastSyncedAt: null,
          dataCount: 0,
          isStale: true,
        };
      }

      // Check for recent insights data
      const recentInsights = await ctx.db
        .query("metaInsights")
        .withIndex("by_org_entity_type_and_id", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .eq("entityType", "account")
            .eq("entityId", args.accountId),
        )
        .order("desc")
        .take(1);

      const dataCount = recentInsights.length;
      const lastSyncedAt = metaAccount.syncedAt;
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const isStale = !lastSyncedAt || lastSyncedAt < twentyFourHoursAgo;

      return {
        hasSyncedData: dataCount > 0,
        lastSyncedAt,
        dataCount,
        isStale,
      };
    }

    return {
      hasSyncedData: false,
      lastSyncedAt: null,
      dataCount: 0,
      isStale: true,
    };
  },
});

/**
 * Get sync profile
 */
export const getSyncProfile = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      activityScore: v.number(),
      syncFrequency: v.number(),
      syncInterval: v.number(),
      lastSync: v.union(v.null(), v.number()),
      nextSync: v.union(v.null(), v.number()),
      isBusinessHours: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const syncProfile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .first();

    if (!syncProfile) {
      // Return default profile
      return {
        activityScore: 0,
        syncFrequency: 1,
        syncInterval: 86400000, // 24 hours
        lastSync: null,
        nextSync: null,
        isBusinessHours: false,
      };
    }

    // Calculate next sync time
    const nextSync = syncProfile.lastSync
      ? syncProfile.lastSync + syncProfile.syncInterval
      : Date.now() + syncProfile.syncInterval;

    return {
      activityScore: syncProfile.activityScore,
      syncFrequency: syncProfile.syncFrequency,
      syncInterval: syncProfile.syncInterval,
      lastSync: syncProfile.lastSync ?? null,
      nextSync,
      isBusinessHours: isBusinessHours(),
    };
  },
});

/**
 * Cancel sync session
 */
export const cancelSync = mutation({
  args: {
    sessionId: v.id("syncSessions"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { orgId } = await requireUserAndOrg(ctx);

    const session = await ctx.db.get(args.sessionId);

    if (!session || session.organizationId !== (orgId as Id<'organizations'>)) {
      throw new Error("Sync session not found or access denied");
    }

    if (session.status === "completed" || session.status === "failed") {
      throw new Error("Cannot cancel completed or failed sync");
    }

    // Update session status
    await ctx.db.patch(args.sessionId, {
      status: "cancelled",
      completedAt: Date.now(),
      error: "Cancelled by user",
    });

    return { success: true };
  },
});

/**
 * Get sync statistics
 */
export const getSyncStatistics = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalSyncs: v.number(),
      successfulSyncs: v.number(),
      failedSyncs: v.number(),
      cancelledSyncs: v.number(),
      totalRecordsProcessed: v.number(),
      avgSyncDuration: v.number(),
      platformBreakdown: v.record(v.string(), v.number()),
      syncTypeBreakdown: v.record(v.string(), v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Default to last 30 days
    const dateRange = args.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10),
      endDate: new Date().toISOString().substring(0, 10),
    };

    const startTime = new Date(dateRange.startDate || "1970-01-01").getTime();
    const endTime =
      new Date(dateRange.endDate || new Date().toISOString().substring(0, 10)).getTime() +
      24 * 60 * 60 * 1000; // Include end date

    // Get sessions for organization within date range using indexed filtering
    const sessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_and_startedAt", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .gte("startedAt", startTime)
          .lte("startedAt", endTime),
      )
      .collect();

    // Calculate statistics
    const stats = {
      totalSyncs: sessions.length,
      successfulSyncs: sessions.filter((s) => s.status === "completed").length,
      failedSyncs: sessions.filter((s) => s.status === "failed").length,
      cancelledSyncs: sessions.filter((s) => s.status === "cancelled").length,
      totalRecordsProcessed: sessions.reduce(
        (sum, s) => sum + (s.recordsProcessed || 0),
        0,
      ),
      avgSyncDuration: 0,
      platformBreakdown: {} as Record<string, number>,
      syncTypeBreakdown: {} as Record<string, number>,
    };

    // Calculate average duration for completed syncs
    const completedSyncs = sessions.filter(
      (s) => s.status === "completed" && s.completedAt,
    );

    if (completedSyncs.length > 0) {
      const totalDuration = completedSyncs.reduce((sum, s) => {
        // We know completedAt exists because we filtered for it above
        if (!s.completedAt) return sum;
        return sum + (s.completedAt - s.startedAt);
      }, 0);

      stats.avgSyncDuration = totalDuration / completedSyncs.length;
    }

    // Platform breakdown
    sessions.forEach((s) => {
      stats.platformBreakdown[s.platform] =
        ((stats.platformBreakdown[s.platform] as number | undefined) || 0) + 1;
      const syncType = s.type || "incremental";

      stats.syncTypeBreakdown[syncType] =
        ((stats.syncTypeBreakdown[syncType] as number | undefined) || 0) + 1;
    });

    return stats;
  },
});

// Helper function
function isBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Monday-Friday, 9am-5pm
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}
