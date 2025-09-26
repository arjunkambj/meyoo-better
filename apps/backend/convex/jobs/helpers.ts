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

/**
 * Initialize sync session batching metadata and baseline progress
 */
export const initializeSyncSessionBatches = internalMutation({
  args: {
    sessionId: v.id("syncSessions"),
    totalBatches: v.number(),
    initialRecordsProcessed: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    const metadata = {
      ...(session.metadata || {}),
      totalBatches: args.totalBatches,
      completedBatches: 0,
    };

    await ctx.db.patch(args.sessionId, {
      metadata,
      recordsProcessed: args.initialRecordsProcessed,
    });
  },
});

/**
 * Increment sync session batch progress and return updated counters
 */
export const incrementSyncSessionProgress = internalMutation({
  args: {
    sessionId: v.id("syncSessions"),
    batchesCompletedDelta: v.number(),
    recordsProcessedDelta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const metadata = session.metadata || {};
    const totalBatches = metadata.totalBatches ?? 0;
    const previousCompleted = metadata.completedBatches ?? 0;
    const nextCompletedRaw = previousCompleted + args.batchesCompletedDelta;
    const nextCompleted = totalBatches > 0
      ? Math.min(totalBatches, nextCompletedRaw)
      : nextCompletedRaw;

    const nextRecordsProcessed =
      args.recordsProcessedDelta !== undefined
        ? (session.recordsProcessed || 0) + args.recordsProcessedDelta
        : session.recordsProcessed || 0;

    await ctx.db.patch(args.sessionId, {
      metadata: {
        ...metadata,
        totalBatches,
        completedBatches: nextCompleted,
      },
      recordsProcessed: nextRecordsProcessed,
    });

    return {
      totalBatches,
      previousCompleted,
      completedBatches: nextCompleted,
      recordsProcessed: nextRecordsProcessed,
      startedAt: session.startedAt,
    };
  },
});
