import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

/**
 * Get the shop domain for the current user's organization
 */
export const getCurrentShopDomain = query({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Get the active Shopify store for this organization
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .eq("isActive", true),
      )
      .first();

    return store?.shopDomain || null;
  },
});
