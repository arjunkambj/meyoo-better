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

/**
 * Get organization details by shop domain
 */
export const getOrganizationDetailsByShopDomain = query({
  args: { shopDomain: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      organizationId: v.string(),
      organizationName: v.string(),
      subscriptionPlan: v.union(
        v.null(),
        v.union(
          v.literal("free"),
          v.literal("starter"),
          v.literal("growth"),
          v.literal("business"),
        ),
      ),
      isPremium: v.optional(v.boolean()),
      requiresUpgrade: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    // Get the store by shop domain
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
      .first();

    if (!store) return null;

    // Get organization details
    const organization = await ctx.db.get(
      store.organizationId as Id<"organizations">,
    );

    if (!organization) return null;

    return {
      organizationId: organization._id,
      organizationName: organization.name,
      subscriptionPlan: null, // Moved to billing table
      isPremium: organization.isPremium,
      requiresUpgrade: organization.requiresUpgrade,
    };
  },
});
