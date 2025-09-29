import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";
import { resolveDashboardConfig } from "../utils/dashboardConfig";

/**
 * Dashboard configuration management
 * Clean 2-zone layout: Zone 1 for KPIs, Zone 2 for Widgets
 */

// ============ QUERIES ============

/**
 * Get dashboard layout configuration
 */
export const getDashboardLayout = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      kpis: v.array(v.string()), // KPI metric IDs
      widgets: v.array(v.string()), // Widget IDs
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    return await resolveDashboardConfig(ctx, auth.user._id, auth.orgId);
  },
});

// ============ MUTATIONS ============

/**
 * Update dashboard layout configuration
 */
export const updateDashboardLayout = mutation({
  args: {
    kpis: v.array(v.string()), // KPI metric IDs
    widgets: v.array(v.string()), // Widget IDs
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);
    const userId = user._id;

    // Check if user already has a personal dashboard
    const userDashboard = await ctx.db
      .query("dashboards")
      .withIndex("by_user_and_isDefault", (q) =>
        q.eq("userId", userId).eq("isDefault", true),
      )
      .first();

    if (userDashboard) {
      // Update existing user-specific dashboard
      await ctx.db.patch(userDashboard._id, {
        config: {
          kpis: args.kpis,
          widgets: args.widgets,
        },
        updatedAt: Date.now(),
      });
    } else {
      // Create new user-specific dashboard
      await ctx.db.insert("dashboards", {
        organizationId: orgId,
        userId: userId,
        name: "My Dashboard",
        description: "Your personalized dashboard",
        type: "main" as const,
        isDefault: true,
        isOrgDefault: false,
        visibility: "private" as const,
        createdBy: userId,
        updatedAt: Date.now(),
        config: {
          kpis: args.kpis,
          widgets: args.widgets,
        },
      });
    }

    return { success: true };
  },
});
