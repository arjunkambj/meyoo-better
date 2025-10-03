import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// Minimal helpers kept for fast-path Shopify handling

export const upsertReceipt = internalMutation({
  args: {
    providerWebhookId: v.string(),
    topic: v.string(),
    shopDomain: v.string(),
  },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    if (!args.providerWebhookId) return { duplicate: false };

    const receiptId = await ctx.db.insert("webhookReceipts", {
      providerWebhookId: args.providerWebhookId,
      topic: args.topic,
      shopDomain: args.shopDomain,
      status: "processed",
      processedAt: Date.now(),
    });

    const receipts = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_provider", (q) =>
        q.eq("providerWebhookId", args.providerWebhookId),
      )
      .collect();
    if (receipts.length <= 1) {
      return { duplicate: false };
    }

    const newReceipt = receipts.find((receipt) => receipt._id === receiptId);
    const newCreationTime = newReceipt?._creationTime ?? Number.MAX_SAFE_INTEGER;
    const hasOlderReceipt = receipts.some((receipt) => {
      if (receipt._id === receiptId) return false;
      if (receipt._creationTime < newCreationTime) return true;
      if (receipt._creationTime > newCreationTime) return false;

      // Tie-break on id to avoid treating simultaneous inserts as duplicates
      return receipt._id < receiptId;
    });

    if (hasOlderReceipt) {
      await ctx.db.delete(receiptId);
      return { duplicate: true };
    }

    return { duplicate: false };
  },
});

export const getOnboardingByOrganization = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("onboarding")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const patchOnboardingById = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
    patch: v.object({
      hasShopifyConnection: v.optional(v.boolean()),
      hasShopifySubscription: v.optional(v.boolean()),
      updatedAt: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.onboardingId, args.patch as any);
    return null;
  },
});

export const updateOrganizationTrialDates = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    trialEndDate: v.number(),
    trialStartDate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!billing) {
      return null;
    }

    await ctx.db.patch(billing._id, {
      trialStartDate: args.trialStartDate || Date.now(),
      trialEndDate: args.trialEndDate,
      trialEndsAt: args.trialEndDate,
      isTrialActive: args.trialEndDate > Date.now(),
      hasTrialExpired: args.trialEndDate <= Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getOrganizationIdByShopDomain = internalQuery({
  args: { shopDomain: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
      .first();
    return (store?.organizationId as unknown as string) || null;
  },
});

export const getCurrentBilling = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();
  },
});
