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
      zone1: v.array(v.string()), // KPI metric IDs
      zone2: v.array(v.string()), // Widget IDs
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
      return orgDashboard.config;
    }

    // Return default configuration if no saved layout exists
    // Aligns with web default (exclude Cost Breakdown by default)
    return {
      zone1: [
        // Top KPIs (10 pinned metrics) — ordered for new users
        // 1) Revenue, 2) Total Ad Spend, 3) COGS, 4) Orders,
        // 5) Net Profit, 6) Taxes Collected, 7) Profit Margin,
        // 8) ROAS, 9) Repeat Rate, 10) AOV
        "revenue",
        "totalAdSpend",
        "cogs",
        "orders",
        "netProfit",
        "taxesCollected",
        "netProfitMargin",
        "blendedRoas",
        "repeatCustomerRate",
        "avgOrderValue",
      ],
      zone2: [
        // Essential widgets for new users (exclude Cost Breakdown by default)
        "adSpendSummary",
        "customerSummary",
        "orderSummary",
      ],
    };
  },
});

// ============ MUTATIONS ============

/**
 * Update dashboard layout configuration (Zone 1 & Zone 2)
 */
export const updateDashboardLayout = mutation({
  args: {
    zone1: v.array(v.string()), // KPI metric IDs
    zone2: v.array(v.string()), // Widget IDs
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
          zone1: args.zone1,
          zone2: args.zone2,
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
          zone1: args.zone1,
          zone2: args.zone2,
        },
      });
    }

    return { success: true };
  },
});
