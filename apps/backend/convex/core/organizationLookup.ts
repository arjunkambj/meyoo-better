import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";

/**
 * Get organization ID by shop domain
 */
export const getOrganizationByShopDomain = query({
  args: { shopDomain: v.string() },
  returns: v.union(v.null(), v.id("organizations")),
  handler: async (ctx, args) => {
    // Get the store by shop domain
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
      .first();

    if (!store) return null;

    return store.organizationId as Id<"organizations">;
  },
});
