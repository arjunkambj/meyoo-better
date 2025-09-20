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

/**
 * Get organization details including shop domain
 */
export const getOrganizationWithShopDomain = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      organizationId: v.string(),
      organizationName: v.string(),
      shopDomain: v.union(v.null(), v.string()),
      hasShopifyConnection: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const organization = await ctx.db.get(auth.orgId as Id<"organizations">);

    if (!organization) return null;

    // Get the active Shopify store for this organization
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .eq("isActive", true),
      )
      .first();

    return {
      organizationId: organization._id,
      organizationName: organization.name,
      shopDomain: store?.shopDomain || null,
      hasShopifyConnection: !!store,
    };
  },
});
