import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { findShopifyStoreByDomain } from "../utils/shop";

export const getOrderByShopifyIdInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    shopifyId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.shopifyId))
      .first();

    if (!order) return null;
    if (order.organizationId !== args.organizationId) return null;
    return order;
  },
});

export const getCustomerByShopifyIdInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    shopifyId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id_store", (q) =>
        q.eq("shopifyId", args.shopifyId).eq("storeId", args.storeId),
      )
      .first();

    if (!customer) return null;
    if (customer.organizationId !== args.organizationId) return null;
    return customer;
  },
});

export const getActiveStoreInternal = internalQuery({
  args: { organizationId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("isActive", true),
      )
      .first();
  },
});

export const getStoreByDomain = internalQuery({
  args: { shopDomain: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await findShopifyStoreByDomain(ctx.db, args.shopDomain);
  },
});

export const getLastSyncTimeInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const lastSession = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("platform", "shopify"),
      )
      .order("desc")
      .first();

    return lastSession?.completedAt
      ? new Date(lastSession.completedAt).toISOString()
      : new Date(Date.now() - 86400000).toISOString();
  },
});
