import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

export const getCurrentMembership = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    return await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .eq("userId", auth.user._id),
      )
      .first();
  },
});

export const getMembershipForUserInternal = internalQuery({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.orgId).eq("userId", args.userId),
      )
      .first();
  },
});
