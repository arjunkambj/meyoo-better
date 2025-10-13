import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const updateStoreLastSyncInternal = internalMutation({
  args: {
    storeId: v.id("shopifyStores"),
    timestamp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);

    if (!store) {
      throw new Error(`Shopify store not found: ${args.storeId}`);
    }

    await ctx.db.patch(args.storeId, {
      lastSyncAt: args.timestamp,
      updatedAt: Date.now(),
    });

    return null;
  },
});
