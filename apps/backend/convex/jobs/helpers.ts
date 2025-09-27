import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

const syncStageState = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
);

/**
 * Create sync session
 */
export const createSyncSession = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    type: v.string(),
    sessionId: v.optional(v.id("syncSessions")),
  },
  returns: v.object({
    sessionId: v.id("syncSessions"),
    alreadyRunning: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const ensureShopifyStageMetadata = async (
      sessionId: Id<"syncSessions">,
    ) => {
      if (args.platform !== "shopify") return;

      const session = await ctx.db.get(sessionId);
      if (!session) return;

      const metadata = (session.metadata || {}) as Record<string, any>;
      const stageStatus = (metadata.stageStatus || {}) as Record<string, any>;

      if (
        stageStatus.products &&
        stageStatus.inventory &&
        stageStatus.customers &&
        stageStatus.orders
      ) {
        return;
      }

      await ctx.db.patch(sessionId, {
        metadata: {
          ...metadata,
          stageStatus: {
            products: stageStatus.products ?? "pending",
            inventory: stageStatus.inventory ?? "pending",
            customers: stageStatus.customers ?? "pending",
            orders: stageStatus.orders ?? "pending",
          },
          syncedEntities: Array.isArray(metadata.syncedEntities)
            ? metadata.syncedEntities
            : [],
        },
      });
    };

    if (args.sessionId) {
      const reserved = await ctx.db.get(args.sessionId);

      if (reserved) {
        if (
          reserved.status === "syncing" ||
          reserved.status === "processing"
        ) {
          return { sessionId: reserved._id, alreadyRunning: true };
        }

        if (reserved.status === "pending") {
          await ctx.db.patch(reserved._id, {
            status: "syncing",
            startedAt: Date.now(),
            type: reserved.type || args.type,
          });

          await ensureShopifyStageMetadata(reserved._id);

          return { sessionId: reserved._id, alreadyRunning: false };
        }
      }
    }

    const statuses: Array<"pending" | "syncing" | "processing"> = [
      "pending",
      "syncing",
      "processing",
    ];

    for (const status of statuses) {
      const existing = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("platform", args.platform)
            .eq("status", status),
        )
        .first();

      if (existing) {
        if (status === "pending") {
          await ctx.db.patch(existing._id, {
            status: "syncing",
            startedAt: Date.now(),
            type: existing.type || args.type,
          });

          await ensureShopifyStageMetadata(existing._id);

          return { sessionId: existing._id, alreadyRunning: false };
        }

        return { sessionId: existing._id, alreadyRunning: true };
      }
    }

    const sessionId = await ctx.db.insert("syncSessions", {
      organizationId: args.organizationId,
      platform: args.platform,
      type: args.type,
      status: "syncing",
      startedAt: Date.now(),
      metadata:
        args.platform === "shopify"
          ? {
              stageStatus: {
                products: "pending",
                inventory: "pending",
                customers: "pending",
                orders: "pending",
              },
              syncedEntities: [],
            }
          : undefined,
    });

    if (args.platform === "shopify") {
      await ensureShopifyStageMetadata(sessionId);
    }

    return { sessionId, alreadyRunning: false };
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
    metrics: v.optional(
      v.object({
        baselineRecords: v.optional(v.number()),
        ordersQueued: v.optional(v.number()),
        productsProcessed: v.optional(v.number()),
        customersProcessed: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    const metadata = {
      ...(session.metadata || {}),
      totalBatches: args.totalBatches,
      completedBatches: 0,
      baselineRecords:
        args.metrics?.baselineRecords ?? args.initialRecordsProcessed,
      ordersQueued: args.metrics?.ordersQueued,
      productsProcessed: args.metrics?.productsProcessed,
      customersProcessed: args.metrics?.customersProcessed,
      ordersProcessed: 0,
    } as Record<string, any>;

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

    const metadata = (session.metadata || {}) as Record<string, any>;
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

    const baselineRecords = metadata.baselineRecords ?? 0;
    const previousOrdersProcessed = metadata.ordersProcessed ?? 0;
    const ordersProcessedDelta = args.recordsProcessedDelta ?? 0;
    const nextOrdersProcessed =
      args.recordsProcessedDelta !== undefined
        ? previousOrdersProcessed + ordersProcessedDelta
        : previousOrdersProcessed;

    await ctx.db.patch(args.sessionId, {
      metadata: {
        ...metadata,
        totalBatches,
        completedBatches: nextCompleted,
        baselineRecords,
        ordersProcessed: nextOrdersProcessed,
      } as Record<string, any>,
      recordsProcessed: nextRecordsProcessed,
    });

    return {
      totalBatches,
      previousCompleted,
      completedBatches: nextCompleted,
      recordsProcessed: nextRecordsProcessed,
      startedAt: session.startedAt,
      ordersProcessed: nextOrdersProcessed,
      baselineRecords,
    };
  },
});

/**
 * Patch sync session metadata with progress markers
 */
export const patchSyncSessionMetadata = internalMutation({
  args: {
    sessionId: v.id("syncSessions"),
    metadata: v.object({
      lastCursor: v.optional(v.union(v.string(), v.null())),
      currentPage: v.optional(v.number()),
      totalOrdersSeen: v.optional(v.number()),
      totalPages: v.optional(v.number()),
      stageStatus: v.optional(
        v.object({
          products: v.optional(syncStageState),
          inventory: v.optional(syncStageState),
          customers: v.optional(syncStageState),
          orders: v.optional(syncStageState),
        }),
      ),
      syncedEntities: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    const existing = (session.metadata || {}) as Record<string, unknown>;
    const nextMetadata: Record<string, unknown> = { ...existing };

    const { stageStatus, syncedEntities, ...rest } = args.metadata;

    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) {
        nextMetadata[key] = value;
      }
    }

    if (stageStatus) {
      const existingStage = (
        existing.stageStatus as Record<string, unknown> | undefined
      ) || {};
      nextMetadata.stageStatus = {
        ...existingStage,
        ...stageStatus,
      };
    }

    if (syncedEntities) {
      const current = Array.isArray(existing.syncedEntities)
        ? (existing.syncedEntities as string[])
        : [];
      const merged = new Set([...current, ...syncedEntities]);
      nextMetadata.syncedEntities = Array.from(merged);
    }

    await ctx.db.patch(args.sessionId, {
      metadata: nextMetadata,
    });
  },
});
