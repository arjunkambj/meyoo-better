import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireUserAndOrg } from "../utils/auth";

/**
 * Integration Requests API
 * Manage user requests for new platform integrations
 */

/**
 * Create a new integration request
 */
export const createRequest = mutation({
  args: {
    platformName: v.string(),
    description: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    requestId: v.id("integrationRequests"),
  }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);
    const normalizedPlatform = args.platformName.toLowerCase();

    // Check if user already requested this platform
    const existingRequest = await ctx.db
      .query("integrationRequests")
      .withIndex("by_user_platform", (q) =>
        q.eq("userId", user._id).eq("platformName", normalizedPlatform),
      )
      .first();

    if (existingRequest) {
      throw new ConvexError("You have already requested this integration");
    }

    const requestId = await ctx.db.insert("integrationRequests", {
      platformName: normalizedPlatform,
      description: args.description,
      userId: user._id,
      organizationId: orgId as Id<"organizations">,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      requestId,
    };
  },
});
