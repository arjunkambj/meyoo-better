import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

export const getMemberships = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    return await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();
  },
});

export const setSeat = mutation({
  args: {
    memberId: v.id("users"),
    seatType: v.union(v.literal("free"), v.literal("paid")),
    hasAiAddOn: v.optional(v.boolean()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user: acting, orgId } = await requireUserAndOrg(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", orgId as Id<"organizations">)
          .eq("userId", acting._id),
      )
      .first();
    if (!membership || membership.role !== "StoreOwner") {
      throw new Error("Insufficient permissions");
    }
    const target = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", orgId as Id<"organizations">)
          .eq("userId", args.memberId),
      )
      .first();
    if (!target) throw new Error("Membership not found");
    await ctx.db.patch(target._id, {
      seatType: args.seatType,
      hasAiAddOn: args.hasAiAddOn ?? target.hasAiAddOn ?? false,
      hasAIAccess: args.seatType === "paid" || !!(args.hasAiAddOn ?? target.hasAiAddOn),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
