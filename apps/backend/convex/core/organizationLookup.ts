import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { findShopifyStoreByDomain } from "../utils/shop";

/**
 * Get organization ID by shop domain
 */
export const getOrganizationByShopDomain = query({
  args: { shopDomain: v.string() },
  returns: v.union(v.null(), v.id("organizations")),
  handler: async (ctx, args) => {
    // Get the store by shop domain
    const store = await findShopifyStoreByDomain(ctx.db, args.shopDomain);

    if (!store) return null;

    return store.organizationId as Id<"organizations">;
  },
});
