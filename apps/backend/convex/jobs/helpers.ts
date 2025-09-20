import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

/**
 * Create sync session
 */
export const createSyncSession = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    // Dedup/lock: if a sync is already running for this org+platform, reuse it
    const existing = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("platform", args.platform)
          .eq("status", "syncing"),
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("syncSessions", {
      organizationId: args.organizationId,
      platform: args.platform,
      type: args.type,
      status: "syncing",
      startedAt: Date.now(),
    });
  },
});

/**
 * Update sync session
 */
export const updateSyncSession = internalMutation({
  args: {
    sessionId: v.optional(v.id("syncSessions")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("syncing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    recordsProcessed: v.optional(v.number()),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.sessionId) return;

    const sessionId = args.sessionId;

    // Ensure the session still exists; if not, no-op to avoid throwing in background jobs
    const existing = await ctx.db.get(sessionId);
    if (!existing) return;

    const updates: {
      status:
        | "pending"
        | "processing"
        | "syncing"
        | "completed"
        | "failed"
        | "cancelled";
      recordsProcessed?: number;
      error?: string;
      completedAt?: number;
      duration?: number;
    } = { status: args.status };

    if (args.recordsProcessed !== undefined) {
      updates.recordsProcessed = args.recordsProcessed;
    }
    if (args.error !== undefined) {
      updates.error = args.error;
    }
    if (args.completedAt !== undefined) {
      updates.completedAt = args.completedAt;
    }

    await ctx.db.patch(sessionId, updates);
  },
});
