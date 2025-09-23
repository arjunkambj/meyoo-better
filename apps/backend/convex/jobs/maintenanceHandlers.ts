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
    const page = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .order("desc")
      .paginate({ numItems: args.limit ?? 50, cursor: args.cursor ?? null });

    return {
      ids: page.page.map((s) => s._id),
      nextCursor: page.continueCursor ?? null,
    };
  },
});

/**
 * Patch a single store's userId (small batch helper)
 */
export const patchStoreUserId = internalMutation({
  args: {
    storeId: v.id("shopifyStores"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store) return;
    if (store.userId === args.userId) return;
    await ctx.db.patch(args.storeId, {
      userId: args.userId,
      updatedAt: Date.now(),
    });
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
    const totalUpdated = 0;

    do {
      const page = (await ctx.runQuery(
        internal.jobs.maintenanceHandlers.listStoreIdsByOrganization,
        { organizationId: args.organizationId, cursor, limit: 50 },
      )) as unknown as { ids: Id<"shopifyStores">[]; nextCursor: string | null };
      for (const storeId of page.ids) {
        await ctx.runMutation(internal.jobs.maintenanceHandlers.patchStoreUserId, {
          storeId,
          userId: args.userId,
        });
        // Note: patchStoreUserId is idempotent; only increments when update applies
        // We don’t fetch count per-store; assume potential update
      }
      cursor = page.nextCursor;
    } while (cursor);

    return { success: true, updated: totalUpdated };
  },
});

/**
 * Dedupe Meta ad accounts by (organizationId, accountId)
 * Keeps the most recently updated document and deletes the rest.
 */
export const dedupeMetaAdAccounts = internalAction({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), deleted: v.number() }),
  handler: async (ctx, args) => {
    let deleted = 0;

    const byOrg = await ctx.runQuery(
      internal.jobs.maintenanceHandlers.listMetaAdAccountsByOrg,
      { organizationId: args.organizationId, accountId: args.accountId ?? null },
    );

    // Group by external accountId
    const groups = new Map<string, any[]>();
    for (const acc of byOrg) {
      const key = String((acc as any).accountId);
      const arr = groups.get(key) ?? [];
      arr.push(acc);
      groups.set(key, arr);
    }

    for (const [_key, docs] of groups.entries()) {
      if (docs.length <= 1) continue;
      // Keep the one with latest updatedAt (fallback to createdAt via _id timestamp ordering isn't available, so use updatedAt)
      const sorted = docs.sort((a: any, b: any) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      const [, ...toDelete] = sorted;
      for (const d of toDelete) {
        try {
          await ctx.runMutation(
            internal.jobs.maintenanceHandlers.deleteMetaAdAccountById as any,
            { id: d._id },
          );
          deleted++;
        } catch {
          // best-effort
        }
      }
    }

    return { success: true, deleted };
  },
});

export const listMetaAdAccountsByOrg = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.accountId) {
      return await ctx.db
        .query("metaAdAccounts")
        .withIndex("by_account_org", (q) =>
          q.eq("accountId", String(args.accountId)).eq("organizationId", args.organizationId as Id<"organizations">),
        )
        .collect();
    }
    return await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId as Id<"organizations">))
      .collect();
  },
});

export const deleteMetaAdAccountById = internalMutation({
  args: { id: v.id("metaAdAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
