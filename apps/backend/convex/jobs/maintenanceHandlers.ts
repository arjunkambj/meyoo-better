import { v } from "convex/values";

import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Type definitions for maintenance operations
interface CleanupResult {
  success: boolean;
  recordsCleaned?: number;
  error?: string;
}

/**
 * Handle data cleanup
 */
export const handleDataCleanup = internalAction({
  args: {
    organizationId: v.optional(v.string()),
    daysToKeep: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    recordsCleaned: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, _args): Promise<CleanupResult> => {

    // TODO: Implement cleanup logic here
    // - Remove old sync sessions
    // - Archive old analytics data
    // - Clean up stale webhook logs

    return { success: true, recordsCleaned: 0 };
  },
});

/**
 * List store IDs for an organization with pagination
 */
export const listStoreIdsByOrganization = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    ids: v.array(v.id("shopifyStores")),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const SAFE_LIMIT = Math.max(1, Math.min(args.limit ?? 200, 1000));
    const page = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .order("desc")
      .paginate({ numItems: SAFE_LIMIT, cursor: args.cursor ?? null });

    return {
      ids: page.page.map((s) => s._id),
      nextCursor: page.continueCursor ?? null,
    };
  },
});

// Batch helper to patch many stores in one mutation to reduce function calls
export const patchStoreUsersBatch = internalMutation({
  args: {
    storeIds: v.array(v.id("shopifyStores")),
    userId: v.id("users"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let changed = 0;
    for (const storeId of args.storeIds) {
      const store = await ctx.db.get(storeId);
      if (!store) continue;
      if (store.userId === args.userId) continue;
      await ctx.db.patch(storeId, { userId: args.userId, updatedAt: Date.now() });
      changed += 1;
    }
    return changed;
  },
});

/**
 * Action entry: Reassign all stores in an org to the given userId.
 * Safe to run repeatedly; skips stores already set to that user.
 */
export const handleReassignStoreUsers = internalAction({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.object({ success: v.boolean(), updated: v.number() }),
  handler: async (ctx, args) => {
    let cursor: string | null = null;
    let updated = 0;
    const PAGE = 500; // fewer pages → fewer query calls
    let iterations = 0;
    const MAX_ITER = 1000; // safety guard

    while (iterations < MAX_ITER) {
      const page = (await ctx.runQuery(
        internal.jobs.maintenanceHandlers.listStoreIdsByOrganization,
        { organizationId: args.organizationId, cursor, limit: PAGE },
      )) as unknown as { ids: Id<"shopifyStores">[]; nextCursor: string | null };

      if (page.ids.length > 0) {
        const changed = await ctx.runMutation(
          internal.jobs.maintenanceHandlers.patchStoreUsersBatch,
          {
            storeIds: page.ids,
            userId: args.userId,
          },
        );
        updated += Math.max(0, Number(changed) || 0);
      }

      if (!page.nextCursor || page.nextCursor === cursor) break;
      cursor = page.nextCursor;
      iterations += 1;
    }

    return { success: true, updated };
  },
});
