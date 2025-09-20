import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";

/**
 * Lightweight sync engine health overview for an organization.
 */
export const overview = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    hasProfile: v.boolean(),
    nextScheduledSync: v.optional(v.number()),
    lastSync: v.optional(v.number()),
    active: v.object({
      shopify: v.number(),
      meta: v.number(),
    }),
    lastCompleted: v.object({
      shopify: v.optional(v.number()),
      meta: v.optional(v.number()),
    }),
    isOverdue: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    const sessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const activeShopify = sessions.filter(
      (s) => s.platform === "shopify" && (s.status === "syncing" || s.status === "processing" || s.status === "pending"),
    ).length;
    const activeMeta = sessions.filter(
      (s) => s.platform === "meta" && (s.status === "syncing" || s.status === "processing" || s.status === "pending"),
    ).length;

    const lastCompletedShopify = sessions
      .filter((s) => s.platform === "shopify" && s.status === "completed")
      .sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt))[0];
    const lastCompletedMeta = sessions
      .filter((s) => s.platform === "meta" && s.status === "completed")
      .sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt))[0];

    const now = Date.now();
    const next = profile?.nextScheduledSync;
    const isOverdue = Boolean(
      next && next < now - 5 * 60 * 1000 && // more than 5 minutes overdue
        activeShopify === 0 &&
        activeMeta === 0,
    );

    return {
      hasProfile: !!profile,
      nextScheduledSync: next,
      lastSync: profile?.lastSync,
      active: { shopify: activeShopify, meta: activeMeta },
      lastCompleted: {
        shopify: lastCompletedShopify
          ? lastCompletedShopify.completedAt || lastCompletedShopify.startedAt
          : undefined,
        meta: lastCompletedMeta
          ? lastCompletedMeta.completedAt || lastCompletedMeta.startedAt
          : undefined,
      },
      isOverdue,
    };
  },
});

