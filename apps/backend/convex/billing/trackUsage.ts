import { v } from "convex/values";

import { mutation, query } from "../_generated/server";

/**
 * Placeholder mutation retained for API compatibility. Usage limits are not enforced.
 */
export const trackOrderUsage = mutation({
  args: {
    organizationId: v.string(),
    orderCount: v.number(),
  },
  handler: async () => ({
    success: true,
    orderCount: 0,
    limit: 0,
    requiresUpgrade: false,
  }),
});

/**
 * Usage tracking is disabled; the query now returns null.
 */
export const getCurrentUsage = query({
  args: {},
  handler: async () => null,
});

/**
 * Feature gating is disabled; always allow requested actions.
 */
export const canPerformAction = query({
  args: {
    action: v.string(),
  },
  handler: async () => true,
});
