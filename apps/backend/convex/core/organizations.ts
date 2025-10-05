import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getUserAndOrg } from "../utils/auth";
import { createNewUserData } from "../authHelpers";

/**
 * Organization management
 * Handles organization settings, billing, and team management
 */

// ============ QUERIES ============

export const getOrganizationTimezoneInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    timezone: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    return {
      timezone: organization?.timezone,
    };
  },
});

/**
 * Get current user's organization
 */
export const getCurrentOrganization = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      name: v.string(),
      timezone: v.optional(v.string()),
      primaryCurrency: v.optional(v.string()),
      createdAt: v.string(),
      plan: v.union(v.null(), v.string()),
      status: v.optional(v.string()),
      isTrialActive: v.optional(v.boolean()),
      hasTrialExpired: v.optional(v.boolean()),
      trialEndDate: v.optional(v.number()),
      hasShopifyConnection: v.optional(v.boolean()),
      hasShopifySubscription: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const { user, orgId: organizationId } = auth;

    // Get billing info
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    // Return organization details
    interface UserWithCreatedAt {
      createdAt: number | string;
    }
    const userWithCreatedAt = user as UserWithCreatedAt;
    const createdAtStr =
      typeof userWithCreatedAt.createdAt === "number"
        ? new Date(userWithCreatedAt.createdAt).toISOString()
        : userWithCreatedAt.createdAt;

    // Get organization details
    const org = organizationId ? await ctx.db.get(organizationId) : null;

    return {
      id: organizationId,
      name: org?.name || "My Organization",
      timezone: org?.timezone,
      primaryCurrency: org?.primaryCurrency,
      createdAt: createdAtStr,
      plan: billing?.shopifyBilling?.plan ?? null,
      status: user.status,
      isTrialActive: billing?.isTrialActive,
      hasTrialExpired: billing?.hasTrialExpired,
      trialEndDate: billing?.trialEndDate ?? billing?.trialEndsAt,
      hasShopifyConnection: false, // This is now tracked in onboarding table
      hasShopifySubscription: billing?.shopifyBilling?.isActive || false,
    };
  },
});

/**
 * Get organization by ID
 */
export const getOrganization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      name: v.string(),
      timezone: v.optional(v.string()),
      memberCount: v.number(),
      createdAt: v.string(),
      plan: v.union(v.null(), v.string()),
      status: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const user = auth.user;
    if (user.organizationId !== args.organizationId) return null;

    // Get the organization
    const organization = await ctx.db.get(args.organizationId);

    if (!organization) {
      return null;
    }

    // Count memberships for this organization
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Get billing info
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    interface UserWithCreatedAt {
      createdAt: number | string;
    }
    const userWithCreatedAt = user as UserWithCreatedAt;
    const createdAtStr =
      typeof userWithCreatedAt.createdAt === "number"
        ? new Date(userWithCreatedAt.createdAt).toISOString()
        : userWithCreatedAt.createdAt;

    return {
      id: args.organizationId,
      name: organization.name || "My Organization",
      timezone: organization.timezone,
      memberCount: memberships.length,
      createdAt: createdAtStr,
      plan: billing?.shopifyBilling?.plan ?? null,
      status: user.status,
    };
  },
});

/**
 * Get organization usage statistics
 */
export const getOrganizationUsage = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      ordersThisMonth: v.number(),
      connectedIntegrations: v.number(),
      teamMembers: v.number(),
      plan: v.union(v.null(), v.string()),
      planLimits: v.any(), // Complex object, using any for now
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Get order count for the current month
    const startOfMonth = new Date();

    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { orgId: organizationId } = auth;
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    // Filter in memory
    const filteredOrders = orders.filter(
      (order) => order.shopifyCreatedAt >= startOfMonth.getTime(),
    );

    // Get connected integrations
    const integrations = await ctx.db
      .query("integrationSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    // Filter active integrations in memory
    interface IntegrationSession {
      isActive: boolean;
    }
    const activeIntegrations = integrations.filter(
      (integration) => (integration as IntegrationSession).isActive,
    );

    // Team members via memberships
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Get billing info
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    const plan = billing?.shopifyBilling?.plan ?? null;

    return {
      ordersThisMonth: filteredOrders.length,
      connectedIntegrations: activeIntegrations.length,
      teamMembers: memberships.length,
      plan: plan,
      planLimits: getPlanLimits(plan || "free"),
    };
  },
});

// ============ MUTATIONS ============

/**
 * Update organization settings
 */
export const updateOrganization = mutation({
  args: {
    name: v.optional(v.string()),
    currency: v.optional(v.string()),
    fiscalYearStart: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Check permissions via membership
    if (!user.organizationId) throw new Error("Organization not found");
    const acting = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", user._id),
      )
      .first();
    const globalRole = user.globalRole;
    const canUpdate =
      acting?.role === "StoreOwner" ||
      globalRole === "MeyooFounder" ||
      globalRole === "MeyooAdmin";
    if (!canUpdate) {
      throw new Error("Insufficient permissions to update organization");
    }

    // Get the organization record
    const organization = await ctx.db.get(
      user.organizationId as Id<"organizations">,
    );

    if (!organization) {
      throw new Error("Organization not found");
    }

    // Prepare organization updates
    const orgUpdates: Partial<{
      name: string;
      locale: string;
      timezone: string;
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) orgUpdates.name = args.name;
    if (args.currency !== undefined) orgUpdates.locale = args.currency; // Map currency to locale
    if (args.timezone !== undefined) orgUpdates.timezone = args.timezone;

    // Update the organization record
    await ctx.db.patch(user.organizationId, orgUpdates);

    return { success: true };
  },
});

/**
 * Update billing plan
 */
export const updateBillingPlan = mutation({
  args: {
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("growth"),
      v.literal("business"),
    ),
    billingCycle: v.optional(
      v.union(v.literal("monthly"), v.literal("yearly")),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    plan: v.string(),
    limits: v.any(), // Complex object
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Check permissions - only owner can change billing
    const membership = user.organizationId
      ? await ctx.db
          .query("memberships")
          .withIndex("by_org_user", (q) =>
            q
              .eq("organizationId", user.organizationId as Id<"organizations">)
              .eq("userId", user._id),
          )
          .first()
      : null;
    if (membership?.role !== "StoreOwner") {
      throw new Error("Only store owner can change billing plan");
    }

    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    // Update billing record
    const { organizationId } = user;
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    if (billing) {
      await ctx.db.patch(billing._id, {
        shopifyBilling: {
          plan: args.plan,
          isActive: true,
        },
        isPremium: args.plan !== "free",
      });
    } else {
      // Create billing if doesn't exist
      await ctx.db.insert("billing", {
        organizationId: organizationId,
        organizationType: "shopify_app",
        shopifyBilling: {
          plan: args.plan,
          isActive: true,
        },
        isPremium: args.plan !== "free",
        billingCycle: "monthly",
        status: "active",
        createdAt: Date.now(),
      });
    }

    return {
      success: true,
      plan: args.plan,
      limits: getPlanLimits(args.plan),
    };
  },
});

/**
 * Remove team member
 */
export const removeTeamMember = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const currentUser = await ctx.db.get(userId);

    if (!currentUser) {
      throw new Error("User not found");
    }

    const currentMembership = currentUser.organizationId
      ? await ctx.db
          .query("memberships")
          .withIndex("by_org_user", (q) =>
            q
              .eq("organizationId", currentUser.organizationId as Id<"organizations">)
              .eq("userId", currentUser._id),
          )
          .first()
      : null;
    const globalRole = currentUser.globalRole;
    const canRemove =
      currentMembership?.role === "StoreOwner" ||
      globalRole === "MeyooFounder" ||
      globalRole === "MeyooAdmin";
    if (!canRemove) {
      throw new Error("Insufficient permissions to remove team members");
    }

    const userToRemove = await ctx.db.get(args.userId);

    if (!userToRemove) {
      throw new Error("User to remove not found");
    }

    if (userToRemove._id === currentUser._id) {
      throw new Error("Cannot remove yourself from the organization");
    }

    if (userToRemove.organizationId !== currentUser.organizationId) {
      throw new Error("User is not in your organization");
    }

    const targetMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", currentUser.organizationId as Id<"organizations">)
          .eq("userId", userToRemove._id),
      )
      .first();

    if (!targetMembership) {
      throw new Error("Membership not found");
    }

    if (targetMembership.role === "StoreOwner") {
      throw new Error("Cannot remove the store owner");
    }

    const now = Date.now();

    if (targetMembership.status !== "removed") {
      await ctx.db.patch(targetMembership._id, {
        status: "removed",
        updatedAt: now,
      });
    }

    await createNewUserData(ctx, userToRemove._id as Id<"users">, {
      name: userToRemove.name || null,
      email: userToRemove.email || null,
    });

    return { success: true };
  },
});

// ============ INTERNAL FUNCTIONS ============

/**
 * Check if organization has reached plan limits
 */
export const checkPlanLimits = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    limitType: v.union(
      v.literal("orders"),
      v.literal("teamMembers"),
      v.literal("integrations"),
    ),
  },
  returns: v.object({
    withinLimit: v.boolean(),
    limit: v.number(),
    current: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get any user from the organization to check plan
    const user = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!user) return { withinLimit: false, limit: 0, current: 0 };

    // Get billing info
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    const plan = billing?.shopifyBilling?.plan ?? "free";
    const _limits = getPlanLimits(plan);

    let current = 0;

    switch (args.limitType) {
      case "orders": {
        const startOfMonth = new Date();

        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const orders = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect();

        // Filter in memory
        const filteredOrders = orders.filter(
          (order) => order.shopifyCreatedAt >= startOfMonth.getTime(),
        );

        current = filteredOrders.length;
        break;
      }

      case "teamMembers": {
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
          .collect();

        current = memberships.length;
        break;
      }

      case "integrations": {
        const integrations = await ctx.db
          .query("integrationSessions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect();

        // Filter active integrations in memory
        const activeIntegrations = integrations.filter(
          (integration) => integration.isActive,
        );

        current = activeIntegrations.length;
        break;
      }
    }

    const planLimits = getPlanLimits(plan) || ({} as Record<string, number>);
    const limitValue = planLimits[args.limitType as keyof typeof planLimits];

    return {
      withinLimit:
        typeof limitValue === "number" ? current < limitValue : false,
      limit: typeof limitValue === "number" ? limitValue : 0,
      current,
    };
  },
});

// ============ HELPER FUNCTIONS ============

/**
 * Get plan limits
 */
function getPlanLimits(plan: string) {
  const limits: Record<
    string,
    {
      orders: number;
      teamMembers: number;
      integrations: number;
      marketingChannels: number;
      aiInsights: boolean;
      prioritySupport: boolean;
    }
  > = {
    free: {
      orders: 300,
      teamMembers: 3,
      integrations: 1,
      marketingChannels: 1,
      aiInsights: false,
      prioritySupport: false,
    },
    starter: {
      orders: 1200,
      teamMembers: 3,
      integrations: 999,
      marketingChannels: 999,
      aiInsights: false,
      prioritySupport: false,
    },
    growth: {
      orders: 3500,
      teamMembers: 5,
      integrations: 999,
      marketingChannels: 999,
      aiInsights: false,
      prioritySupport: true,
    },
    business: {
      orders: 7500,
      teamMembers: 10,
      integrations: 999,
      marketingChannels: 999,
      aiInsights: true,
      prioritySupport: true,
    },
  };

  return limits[plan] || limits.free;
}

/**
 * Calculate monthly price for plan
 */
export function getPlanPrice(
  plan: string,
  billingCycle: "monthly" | "yearly" = "monthly",
) {
  const monthlyPrices: Record<string, number> = {
    free: 0,
    starter: 40,
    growth: 90,
    business: 160,
  };

  const price = monthlyPrices[plan] || 0;

  // 10% discount for yearly billing
  if (billingCycle === "yearly") {
    return price * 0.9;
  }

  return price;
}

// ============ INVOICE QUERIES ============

/**
 * Get invoices for current organization
 */
export const getInvoices = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        id: v.string(),
        invoiceNumber: v.string(),
        amount: v.number(),
        currency: v.string(),
        status: v.string(),
        plan: v.string(),
        description: v.string(),
        billingPeriodStart: v.string(),
        billingPeriodEnd: v.string(),
        issuedAt: v.number(),
        paidAt: v.optional(v.number()),
        downloadUrl: v.optional(v.string()),
        metadata: v.optional(v.any()),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId)
      return { page: [], continueCursor: "", isDone: true };

    const user = await ctx.db.get(userId);

    if (!user?.organizationId)
      return { page: [], continueCursor: "", isDone: true };

    // Query invoices for this organization using the index for pagination
    const { organizationId } = user;
    const pagination = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .paginate({
        cursor: args.paginationOpts.cursor ?? null,
        numItems: args.paginationOpts.numItems,
      });

    // Format invoices for response
    const formattedInvoices = pagination.page.map((invoice) => ({
      id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      plan: invoice.plan,
      description: invoice.description,
      billingPeriodStart: invoice.billingPeriodStart,
      billingPeriodEnd: invoice.billingPeriodEnd,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      downloadUrl: invoice.downloadUrl,
      metadata: invoice.metadata,
    }));

    return {
      page: formattedInvoices,
      continueCursor: pagination.continueCursor ?? "",
      isDone: pagination.isDone,
    };
  },
});

/**
 * Create invoice (internal use only - called by payment system)
 */
export const createInvoice = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    invoiceNumber: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("paid"),
      v.literal("pending"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("cancelled"),
    ),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("growth"),
      v.literal("business"),
    ),
    description: v.string(),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        amount: v.number(),
      }),
    ),
    billingPeriodStart: v.string(),
    billingPeriodEnd: v.string(),
    paidAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: args.organizationId,
      userId: args.userId,
      invoiceNumber: args.invoiceNumber,
      amount: args.amount,
      currency: args.currency,
      status: args.status,
      plan: args.plan,
      description: args.description,
      lineItems: args.lineItems,
      billingPeriodStart: args.billingPeriodStart,
      billingPeriodEnd: args.billingPeriodEnd,
      issuedAt: Date.now(),
      paidAt: args.paidAt,
      createdAt: Date.now(),
      metadata: args.metadata,
    });

    return { invoiceId };
  },
});

/**
 * Delete invoice
 */
export const deleteInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      throw new ConvexError("User not part of an organization");
    }

    // Get the invoice to verify ownership
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new ConvexError("Invoice not found");
    }

    // Verify the invoice belongs to the user's organization
    if (invoice.organizationId !== user.organizationId) {
      throw new ConvexError("Unauthorized to delete this invoice");
    }

    // Delete the invoice
    await ctx.db.delete(args.invoiceId);

    return { success: true };
  },
});
