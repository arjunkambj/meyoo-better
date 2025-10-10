import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internalQuery, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getUserAndOrg } from "../utils/auth";

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
    const canUpdate = acting?.role === "StoreOwner";
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

// ============ INTERNAL FUNCTIONS ============

// ============ HELPER FUNCTIONS ============

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
