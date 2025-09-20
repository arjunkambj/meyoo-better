import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

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

    // Check if user already requested this platform
    const existingRequest = await ctx.db
      .query("integrationRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.eq(q.field("platformName"), args.platformName.toLowerCase()),
      )
      .first();

    if (existingRequest) {
      throw new ConvexError("You have already requested this integration");
    }

    const requestId = await ctx.db.insert("integrationRequests", {
      platformName: args.platformName.toLowerCase(),
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

/**
 * Get user's integration requests
 */
export const getUserRequests = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("integrationRequests"),
      platformName: v.string(),
      description: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const user = auth.user;

    let requests = await ctx.db
      .query("integrationRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Apply limit if specified
    if (args.limit) {
      requests = requests.slice(0, args.limit);
    }

    return requests.map((request) => ({
      id: request._id,
      platformName: request.platformName,
      description: request.description,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    }));
  },
});

/**
 * Get all integration requests (admin only)
 */
export const getAllRequests = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("integrationRequests"),
      platformName: v.string(),
      description: v.string(),
      organizationId: v.id("organizations"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const user = auth.user;
    if (user.role !== "StoreOwner") return [];

    let requests = await ctx.db
      .query("integrationRequests")
      .withIndex("by_created")
      .order("desc")
      .collect();

    // Apply limit if specified
    if (args.limit) {
      requests = requests.slice(0, args.limit);
    }

    return requests.map((request) => ({
      id: request._id,
      platformName: request.platformName,
      description: request.description,
      organizationId: request.organizationId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    }));
  },
});

/**
 * Update request status (admin only)
 */
// No status update mutation needed for simple schema

/**
 * Get popular requested integrations (public stats)
 */
export const getPopularRequests = query({
  args: {},
  returns: v.array(
    v.object({
      platformName: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const requests = await ctx.db
      .query("integrationRequests")
      .withIndex("by_platform")
      .collect();

    // Group by platform name and count
    const platformCounts = new Map<string, { count: number }>();

    requests.forEach((request) => {
      const existing = platformCounts.get(request.platformName);

      if (existing) {
        existing.count++;
      } else {
        platformCounts.set(request.platformName, { count: 1 });
      }
    });

    // Convert to array and sort by count
    const popular = Array.from(platformCounts.entries())
      .map(([platformName, data]) => ({ platformName, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    return popular;
  },
});
