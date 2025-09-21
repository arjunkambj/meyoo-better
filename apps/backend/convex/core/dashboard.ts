import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

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
    const userId = auth.user._id;
    const user = auth.user;

    // First, try to get user-specific dashboard
    const userDashboard = await ctx.db
      .query("dashboards")
      .withIndex("by_user_and_isDefault", (q) =>
        q.eq("userId", userId).eq("isDefault", true),
      )
      .first();

    if (userDashboard?.config) {
      // Handle legacy format
      const config = userDashboard.config as any;
      if (config.zone1 && config.zone2) {
        return {
          kpis: config.zone1,
          widgets: config.zone2,
        };
      }
      return userDashboard.config;
    }

    // If no user-specific dashboard, get organization default using dedicated flag
    const orgDashboard = await ctx.db
      .query("dashboards")
      .withIndex("by_org_isDefault_orgDefault", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("isDefault", true)
          .eq("isOrgDefault", true),
      )
      .first();

    if (orgDashboard?.config) {
      // Handle legacy format
      const config = orgDashboard.config as any;
      if (config.zone1 && config.zone2) {
        return {
          kpis: config.zone1,
          widgets: config.zone2,
        };
      }
      return orgDashboard.config;
    }

    // Return default configuration if no saved layout exists
    return {
      kpis: [
        // Default KPIs - ordered for new users
        "netProfit",
        "revenue",
        "netProfitMargin",
        "orders",
        "avgOrderValue",
        "blendedRoas", // MER
        "totalAdSpend",
        "shopifyConversionRate",
        "repeatCustomerRate",
        "moMRevenueGrowth",
      ],
      widgets: [
        // Essential widgets for new users
        "adSpendSummary",
        "customerSummary",
        "orderSummary",
      ],
    };
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
