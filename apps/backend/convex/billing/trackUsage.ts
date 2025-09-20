import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";

/**
 * Track usage metrics for billing enforcement
 * This tracks orders per month for each organization
 */
export const trackOrderUsage = mutation({
  args: {
    organizationId: v.string(), // Using string ID for organization
    orderCount: v.number(),
  },
  handler: async (ctx, args) => {
    const { organizationId, orderCount } = args;

    // Get current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-based month
    const monthKey = `${year}-${month.toString().padStart(2, "0")}`;

    // Get the organization record by ID
    const organization = await ctx.db.get(
      organizationId as Id<"organizations">,
    );

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    // Find or create usage tracking record
    const usageRecord = await ctx.db
      .query("usage")
      .withIndex("by_org_month", (q) =>
        q.eq("organizationId", organizationId as Id<"organizations">).eq("month", monthKey),
      )
      .first();

    if (!usageRecord) {
      // Create usage tracking record
      await ctx.db.insert("usage", {
        organizationId: organizationId as Id<"organizations">,
        month: monthKey,
        type: "orders",
        count: orderCount,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return {
        success: true,
        orderCount,
        limit: 300, // Free tier limit
        requiresUpgrade: orderCount > 300,
      };
    }

    // Check if we already have a usage record for this month
    const existingUsage = await ctx.db
      .query("usage")
      .withIndex("by_org_month", (q) =>
        q.eq("organizationId", organization._id).eq("month", monthKey),
      )
      .first();

    if (existingUsage) {
      // Update existing record
      await ctx.db.patch(existingUsage._id, {
        count: orderCount,
        updatedAt: Date.now(),
      });
    } else {
      // Create new record
      await ctx.db.insert("usage", {
        organizationId: organization._id,
        month: monthKey,
        type: "orders",
        count: orderCount,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Get billing info
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId as Id<"organizations">),
      )
      .first();

    const planLimits: Record<string, number> = {
      free: 300,
      starter: 1200,
      growth: 3500,
      business: 7500,
    };

    // Expose null when no plan is selected; still use Free limit as baseline
    const _currentPlan = billing?.shopifyBilling?.plan ?? null;
    const planKeyForLimit = billing?.shopifyBilling?.plan || "free";
    const limit = planLimits[planKeyForLimit] || 300;

    // If over limit, mark organization as needing upgrade
    if (orderCount > limit) {
      await ctx.db.patch(organization._id, {
        requiresUpgrade: true,
      });
    } else if (organization.requiresUpgrade && orderCount <= limit) {
      // Clear upgrade requirement if back under limit
      await ctx.db.patch(organization._id, {
        requiresUpgrade: false,
      });
    }

    return {
      success: true,
      orderCount,
      limit,
      requiresUpgrade: orderCount > limit,
    };
  },
});

/**
 * Get current month's usage for an organization
 */
export const getCurrentUsage = query({
  args: {},
  handler: async (ctx) => {
    // Get from authenticated user
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;

    // Get user's organization
    const user = await ctx.db.get(userId);

    if (!user || !user.organizationId) return null;

    // Get the organization record by ID
    const organization = user.organizationId
      ? await ctx.db.get(user.organizationId)
      : null;

    if (!organization) return null;

    // Get current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthKey = `${year}-${month.toString().padStart(2, "0")}`;

    // Get usage record
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_org_month", (q) =>
        q.eq("organizationId", organization._id).eq("month", monthKey),
      )
      .first();

    // Get billing info
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .first();

    const planLimits: Record<string, number> = {
      free: 300,
      starter: 1200,
      growth: 3500,
      business: 7500,
    };

    // Expose null when no plan is selected; still use Free limit as baseline
    const currentPlan = billing?.shopifyBilling?.plan ?? null;
    const planKeyForLimit = billing?.shopifyBilling?.plan || "free";
    const limit = planLimits[planKeyForLimit] || 300;
    const currentUsage = usage?.count || 0;
    const percentage = (currentUsage / limit) * 100;

    // Check if on trial
    const isOnTrial = billing?.status === "trial";
    const trialEndsAt = billing?.trialEndsAt;
    const daysLeftInTrial = trialEndsAt
      ? Math.max(
          0,
          Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)),
        )
      : 0;

    return {
      plan: currentPlan,
      currentUsage,
      limit,
      percentage,
      requiresUpgrade: organization.requiresUpgrade || false,
      month: monthKey,
      isOnTrial,
      trialEndsAt,
      daysLeftInTrial,
      billingStatus: billing?.status,
    };
  },
});

/**
 * Check if organization can perform action based on plan limits
 */
export const canPerformAction = query({
  args: {
    action: v.string(), // e.g., "sync", "export", "api_access"
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return false;

    const user = await ctx.db.get(userId);

    if (!user || !user.organizationId) return false;

    // Get the organization record by ID
    const organization = user.organizationId
      ? await ctx.db.get(user.organizationId)
      : null;

    if (!organization) return false;

    // Get billing info
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .first();

    const currentPlan = billing?.shopifyBilling?.plan ?? "free";

    // Define feature access per plan
    const planFeatures: Record<string, string[]> = {
      free: ["sync", "basic_export"],
      starter: ["sync", "export", "api_access", "email_reports"],
      growth: [
        "sync",
        "export",
        "api_access",
        "email_reports",
        "advanced_analytics",
      ],
      business: [
        "sync",
        "export",
        "api_access",
        "email_reports",
        "advanced_analytics",
        "ai_insights",
      ],
    };

    const knownPlans = ["free", "starter", "growth", "business"] as const;
    const planKey = (knownPlans as readonly string[]).includes(currentPlan)
      ? (currentPlan as (typeof knownPlans)[number])
      : "free";
    const allowedActions: string[] = (planFeatures[planKey] ?? planFeatures.free) as string[];

    return allowedActions.includes(args.action);
  },
});
