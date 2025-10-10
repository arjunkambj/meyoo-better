import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

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
