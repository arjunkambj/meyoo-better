import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { createMonthlyInvoiceIfMissing } from "../utils/billing";

/**
 * Get organization by user
 */
export const getOrganizationByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;

    const user = await ctx.db.get(userId);

    if (!user || !user.organizationId) return null;

    // Get organization by ID
    const organization = await ctx.db.get(user.organizationId);

    return organization;
  },
});

/**
 * Internal mutation for updating organization plan from webhooks
 */
export const updateOrganizationPlanInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("growth"),
      v.literal("business"),
    ),
    shopifySubscriptionId: v.optional(v.string()),
    shopifySubscriptionStatus: v.optional(v.string()),
    subscriptionPlan: v.optional(v.string()), // Display name like "Free Plan"
    hasShopifySubscription: v.optional(v.boolean()),
    billingCycle: v.optional(
      v.union(v.literal("monthly"), v.literal("yearly")),
    ),
  },
  handler: async (ctx, args) => {
    const { organizationId, plan } = args;

    // Get organization by ID
    const organization = await ctx.db.get(organizationId);

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    // Update organization plan - only include fields that exist in organizations schema
    // Note: Billing is the source of truth. Do not mirror isPremium/trial on organizations.
    await ctx.db.patch(organization._id, {
      updatedAt: Date.now(),
    });

    // Update or create billing record
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    const previousPlan = billing?.shopifyBilling?.plan || "free";
    const becamePaid = previousPlan === "free" && plan !== "free";

    // Determine status from Shopify status if available
    const normalizedShopifyStatus = (
      args.shopifySubscriptionStatus || ""
    ).toUpperCase();
    const derivedStatus =
      plan === "free"
        ? normalizedShopifyStatus === "CANCELLED" ||
          normalizedShopifyStatus === "EXPIRED"
          ? "cancelled"
          : "trial"
        : "active";
    const isActive = plan !== "free" && normalizedShopifyStatus !== "PAUSED";

    if (billing) {
      await ctx.db.patch(billing._id, {
        shopifyBilling: {
          plan,
          isActive,
          shopifySubscriptionId: args.shopifySubscriptionId,
          status: args.shopifySubscriptionStatus,
        },
        isPremium: plan !== "free" || derivedStatus === "trial",
        status: derivedStatus,
        billingCycle: args.billingCycle || billing.billingCycle || "monthly",
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("billing", {
        organizationId: organizationId,
        organizationType: "shopify_app",
        shopifyBilling: {
          plan,
          isActive,
          shopifySubscriptionId: args.shopifySubscriptionId,
          status: args.shopifySubscriptionStatus,
        },
        isPremium: plan !== "free" || derivedStatus === "trial",
        billingCycle: args.billingCycle || "monthly",
        status: derivedStatus,
        createdAt: Date.now(),
      });
    }

    // Create initial invoice when transitioning from free -> paid (idempotent-ish)
    if (becamePaid) {
      const org = await ctx.db.get(organizationId);

      if (org?.ownerId) {
        // const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        //   .toISOString()
        //   .slice(0, 10);

        await createMonthlyInvoiceIfMissing(ctx, {
          organizationId,
          ownerId: org.ownerId,
          plan,
          description: args.subscriptionPlan,
          currency: 'USD',
        });
      }
    }

    return { success: true };
  },
});

/**
 * Internal mutation for updating organization plan with transition tracking
 */
export const updateOrganizationPlanInternalWithTracking = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("growth"),
      v.literal("business"),
    ),
    shopifySubscriptionId: v.optional(v.string()),
    shopifySubscriptionStatus: v.optional(v.string()),
    subscriptionPlan: v.optional(v.string()),
    hasShopifySubscription: v.optional(v.boolean()),
    billingCycle: v.optional(
      v.union(v.literal("monthly"), v.literal("yearly")),
    ),
    isUpgrade: v.optional(v.boolean()),
    previousSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId, plan, isUpgrade, previousSubscriptionId } = args;

    // Get organization by ID
    const organization = await ctx.db.get(organizationId);

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    // Update or create billing record
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    const previousPlan = billing?.shopifyBilling?.plan || "free";
    const becamePaid = previousPlan === "free" && plan !== "free";

    // Determine status from Shopify status if available
    const normalizedShopifyStatus = (
      args.shopifySubscriptionStatus || ""
    ).toUpperCase();
    const derivedStatus =
      plan === "free"
        ? normalizedShopifyStatus === "CANCELLED" ||
          normalizedShopifyStatus === "EXPIRED"
          ? "cancelled"
          : "trial"
        : "active";
    const isActive = plan !== "free" && normalizedShopifyStatus !== "PAUSED";

    // Build transition history
    const transitionHistory = billing?.shopifyBilling?.transitionHistory || [];
    if (isUpgrade && previousPlan !== plan) {
      transitionHistory.push({
        fromPlan: previousPlan,
        toPlan: plan,
        subscriptionId: args.shopifySubscriptionId || "",
        timestamp: Date.now(),
      });
    }

    if (billing) {
      await ctx.db.patch(billing._id, {
        shopifyBilling: {
          plan,
          isActive,
          shopifySubscriptionId: args.shopifySubscriptionId,
          status: args.shopifySubscriptionStatus,
          previousSubscriptionId: isUpgrade ? previousSubscriptionId : billing.shopifyBilling?.previousSubscriptionId,
          isUpgrading: isUpgrade,
          lastTransitionAt: isUpgrade ? Date.now() : billing.shopifyBilling?.lastTransitionAt,
          transitionHistory,
        },
        isPremium: plan !== "free" || derivedStatus === "trial",
        status: derivedStatus,
        billingCycle: args.billingCycle || billing.billingCycle || "monthly",
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("billing", {
        organizationId: organizationId,
        organizationType: "shopify_app",
        shopifyBilling: {
          plan,
          isActive,
          shopifySubscriptionId: args.shopifySubscriptionId,
          status: args.shopifySubscriptionStatus,
          previousSubscriptionId: isUpgrade ? previousSubscriptionId : undefined,
          isUpgrading: isUpgrade,
          lastTransitionAt: isUpgrade ? Date.now() : undefined,
          transitionHistory,
        },
        isPremium: plan !== "free" || derivedStatus === "trial",
        billingCycle: args.billingCycle || "monthly",
        status: derivedStatus,
        createdAt: Date.now(),
      });
    }

    // Handle invoices - clean up duplicates if upgrading
    if (isUpgrade && previousSubscriptionId) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);

      // Find and delete/supersede old invoices for this period
      const existingInvoices = await ctx.db
        .query("invoices")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();

      for (const invoice of existingInvoices) {
        // Delete invoices from previous subscription for the same period
        if (invoice.billingPeriodStart === periodStart && 
            invoice.shopifySubscriptionId === previousSubscriptionId) {
          await ctx.db.delete(invoice._id);
        }
      }
    }

    // Create initial invoice when transitioning from free -> paid (idempotent-ish)
    if (becamePaid || isUpgrade) {
      const org = await ctx.db.get(organizationId);

      if (org?.ownerId) {

        // Issue invoice if missing (dedup inside helper)
        {
          await createMonthlyInvoiceIfMissing(ctx, {
            organizationId,
            ownerId: org.ownerId,
            plan,
            subscriptionId: args.shopifySubscriptionId,
            description: args.subscriptionPlan,
            currency: 'USD',
            matchBySubscription: true,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Public mutation for updating organization plan (for client use)
 */
export const updateOrganizationPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("growth"),
      v.literal("business"),
    ),
    shopifySubscriptionId: v.optional(v.string()),
    shopifySubscriptionStatus: v.optional(v.string()),
    subscriptionPlan: v.optional(v.string()),
    hasShopifySubscription: v.optional(v.boolean()),
    billingCycle: v.optional(
      v.union(v.literal("monthly"), v.literal("yearly")),
    ),
  },
  handler: async (ctx, args) => {
    // Get the current user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify the user has access to this organization
    const user = await ctx.db.get(userId);
    if (!user || user.organizationId !== args.organizationId) {
      throw new Error("Unauthorized");
    }

    // Delegate to the internal mutation logic directly (reuse the same handler)
    const { organizationId, plan } = args;

    // Get organization by ID
    const organization = await ctx.db.get(organizationId);

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    // Update organization plan - only include fields that exist in organizations schema
    // Note: Billing is the source of truth. Do not mirror isPremium/trial on organizations.
    await ctx.db.patch(organization._id, {
      updatedAt: Date.now(),
    });

    // Update or create billing record
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    const previousPlan = billing?.shopifyBilling?.plan || "free";
    const becamePaid = previousPlan === "free" && plan !== "free";

    // Helper: simple plan price map (monthly)
    const planPrices: Record<typeof plan, number> = {
      free: 0,
      starter: 40,
      growth: 90,
      business: 160,
    } as const;

    // Determine status from Shopify status if available
    const normalizedShopifyStatus = (
      args.shopifySubscriptionStatus || ""
    ).toUpperCase();
    const derivedStatus =
      plan === "free"
        ? normalizedShopifyStatus === "CANCELLED" ||
          normalizedShopifyStatus === "EXPIRED"
          ? "cancelled"
          : "trial"
        : "active";
    const isActive = plan !== "free" && normalizedShopifyStatus !== "PAUSED";

    if (billing) {
      await ctx.db.patch(billing._id, {
        shopifyBilling: {
          plan,
          isActive,
          shopifySubscriptionId: args.shopifySubscriptionId,
          status: args.shopifySubscriptionStatus,
        },
        isPremium: plan !== "free" || derivedStatus === "trial",
        status: derivedStatus,
        billingCycle: args.billingCycle || billing.billingCycle || "monthly",
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("billing", {
        organizationId: organizationId,
        organizationType: "shopify_app",
        shopifyBilling: {
          plan,
          isActive,
          shopifySubscriptionId: args.shopifySubscriptionId,
          status: args.shopifySubscriptionStatus,
        },
        isPremium: plan !== "free" || derivedStatus === "trial",
        billingCycle: args.billingCycle || "monthly",
        status: derivedStatus,
        createdAt: Date.now(),
      });
    }

    // Create initial invoice when transitioning from free -> paid (idempotent-ish)
    if (becamePaid) {
      const org = await ctx.db.get(organizationId);

      if (org?.ownerId) {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .slice(0, 10);

        // Basic duplicate guard: if an invoice exists this month, skip
        const existingThisMonth = await ctx.db
          .query("invoices")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect();

        const alreadyHasInvoice = existingThisMonth.some(
          (inv) => inv.billingPeriodStart === periodStart && inv.plan === plan,
        );

        if (!alreadyHasInvoice) {
          const amount = planPrices[plan] || 0;
          const invoiceNumber = `INV-${now.getFullYear()}-${String(
            now.getMonth() + 1,
          ).padStart(
            2,
            "0",
          )}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

          await ctx.db.insert("invoices", {
            organizationId,
            userId: org.ownerId,
            invoiceNumber,
            amount,
            currency: "USD",
            status: "paid",
            plan,
            description: `${args.subscriptionPlan || plan} - Monthly`,
            lineItems: [
              {
                description: `${args.subscriptionPlan || plan} Plan`,
                quantity: 1,
                unitPrice: amount,
                amount,
              },
            ],
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            issuedAt: Date.now(),
            paidAt: Date.now(),
            createdAt: Date.now(),
            metadata: {
              // Keep metadata limited to allowed fields in schema
            },
          });
        }
      }
    }

    return { success: true };
  },
});
