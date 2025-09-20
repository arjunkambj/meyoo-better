import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { createJob, PRIORITY } from "../engine/workpool";
import { normalizeShopDomain } from "../utils/shop";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";
import { isIanaTimeZone } from "@repo/time";
import { ONBOARDING_STEPS } from "@repo/types";

/**
 * Onboarding flow management
 * Handles the 5-step onboarding process and triggers initial 60-day sync
 */

// ============ QUERIES ============

/**
 * Get current onboarding status
 */
export const getOnboardingStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      completed: v.boolean(),
      currentStep: v.number(),
      completedSteps: v.array(v.string()),
      connections: v.object({
        shopify: v.boolean(),
        meta: v.boolean(),
      }),
      hasShopifySubscription: v.boolean(),
      isProductCostSetup: v.boolean(),
      isExtraCostSetup: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const { user, orgId } = auth;

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", user._id).eq("organizationId", orgId),
      )
      .first();

    if (!onboarding) return null;

    // Check connected platforms from onboarding record
    const connections = {
      shopify: onboarding.hasShopifyConnection || false,
      meta: onboarding.hasMetaConnection || false,
    };

    return {
      completed: onboarding.isCompleted || false,
      currentStep: onboarding.onboardingStep || 1,
      completedSteps: onboarding.onboardingData?.completedSteps || [],
      connections,
      hasShopifySubscription: onboarding.hasShopifySubscription || false,
      isProductCostSetup: onboarding.isProductCostSetup || false,
      isExtraCostSetup: onboarding.isExtraCostSetup || false,
    };
  },
});

// ============ HELPER FUNCTIONS ============

/**
 * Get or create onboarding record for user
 */
export const getOrCreateOnboarding = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
) => {
  // Try to find existing onboarding record
  let onboarding = await ctx.db
    .query("onboarding")
    .withIndex("by_user_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();

  // Create if doesn't exist
  if (!onboarding) {
    const onboardingId = await ctx.db.insert("onboarding", {
      userId,
      organizationId,
      onboardingStep: 1,
      isCompleted: false,
      hasShopifyConnection: false,
      hasMetaConnection: false,
      isInitialSyncComplete: false,
      isProductCostSetup: false,
      isExtraCostSetup: false,
      onboardingData: {
        completedSteps: [],
        setupDate: new Date().toISOString(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    onboarding = await ctx.db.get(onboardingId);
  }

  return onboarding;
};

// ============ MUTATIONS ============

/**
 * Update business profile during onboarding
 */
export const updateBusinessProfile = mutation({
  args: {
    organizationName: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessCategory: v.optional(v.string()),
    industry: v.optional(v.string()),
    mobileNumber: v.optional(v.string()),
    mobileCountryCode: v.optional(v.string()),
    referralSource: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    // production: avoid noisy onboarding logs

    interface ProfileUpdates {
      updatedAt: number;
      organizationName?: string;
      businessType?: string;
      businessCategory?: string;
      industry?: string;
      mobileNumber?: string;
      mobileCountryCode?: string;
    }

    const updates: ProfileUpdates = {
      updatedAt: Date.now(),
    };

    // Update fields if provided
    if (args.organizationName !== undefined)
      updates.organizationName = args.organizationName;
    if (args.businessType !== undefined)
      updates.businessType = args.businessType;
    if (args.businessCategory !== undefined)
      updates.businessCategory = args.businessCategory;
    if (args.industry !== undefined) updates.industry = args.industry;
    if (args.mobileNumber !== undefined)
      updates.mobileNumber = args.mobileNumber;
    if (args.mobileCountryCode !== undefined)
      updates.mobileCountryCode = args.mobileCountryCode;

    // Update onboarding record with business profile data
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    const onboarding = await getOrCreateOnboarding(
      ctx,
      user._id,
      user.organizationId,
    );

    if (onboarding && args.referralSource) {
      await ctx.db.patch(onboarding._id, {
        onboardingData: {
          ...onboarding.onboardingData,
          referralSource: args.referralSource,
          setupDate:
            onboarding.onboardingData?.setupDate || new Date().toISOString(),
          completedSteps: onboarding.onboardingData?.completedSteps || [],
        },
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

/**
 * Update onboarding state
 */
export const updateOnboardingState = mutation({
  args: {
    step: v.optional(v.number()),
    connections: v.optional(
      v.object({
        shopify: v.optional(v.boolean()),
        meta: v.optional(v.boolean()),
      }),
    ),
    completedSteps: v.optional(v.array(v.string())),
    isComplete: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    shouldTriggerAnalytics: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    // Get or create onboarding record
    const onboarding = await getOrCreateOnboarding(
      ctx,
      user._id,
      orgId,
    );

    if (!onboarding) {
      throw new Error("Failed to get onboarding record");
    }

    interface OnboardingUpdates {
      updatedAt: number;
      onboardingStep?: number;
      hasShopifyConnection?: boolean;
      hasMetaConnection?: boolean;
      onboardingData?: {
        completedSteps?: string[];
        setupDate?: string;
        referralSource?: string;
      };
      isCompleted?: boolean;
    }

    const updates: OnboardingUpdates = {
      updatedAt: Date.now(),
    };

    if (args.step !== undefined) {
      updates.onboardingStep = args.step;
    }

    if (args.connections) {
      if (args.connections.shopify !== undefined) {
        updates.hasShopifyConnection = args.connections.shopify;
      }
      if (args.connections.meta !== undefined) {
        updates.hasMetaConnection = args.connections.meta;
      }
    }

    if (args.completedSteps !== undefined) {
      updates.onboardingData = {
        ...onboarding.onboardingData,
        completedSteps: args.completedSteps,
      };
    }

    if (args.isComplete !== undefined) {
      updates.isCompleted = args.isComplete;
      // Also update user's isOnboarded flag
      await ctx.db.patch(user._id, { isOnboarded: args.isComplete });
    }

    await ctx.db.patch(onboarding._id, updates);

    // Check if we should trigger analytics
    const shouldTriggerAnalytics =
      args.isComplete ||
      (args.connections && Object.values(args.connections).some((v) => v));

    return {
      success: true,
      shouldTriggerAnalytics: shouldTriggerAnalytics || false,
    };
  },
});

/**
 * Complete onboarding and trigger initial sync
 */
export const completeOnboarding = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    analyticsScheduled: v.boolean(),
    platformsSyncing: v.array(v.string()),
    syncJobs: v.optional(
      v.array(
        v.object({
          platform: v.string(),
          jobId: v.string(),
        }),
      ),
    ),
    syncErrors: v.optional(
      v.array(
        v.object({
          platform: v.string(),
          error: v.string(),
        }),
      ),
    ),
  }),
  handler: async (ctx) => {
    const { user } = await requireUserAndOrg(ctx);

    // production: avoid noisy onboarding logs

    // Get or create onboarding record and mark as complete
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    const onboarding = await getOrCreateOnboarding(ctx, user._id, user.organizationId);

    if (!onboarding) {
      throw new Error("Failed to get onboarding record");
    }

    await ctx.db.patch(onboarding._id, {
      isCompleted: true,
      onboardingStep: ONBOARDING_STEPS.COMPLETE,
      updatedAt: Date.now(),
    });

    // Also update user's isOnboarded flag
    await ctx.db.patch(user._id, {
      isOnboarded: true,
      updatedAt: Date.now(),
    });

    // Get connected platforms for response (but don't trigger syncs)
    const platforms: string[] = [];

    const shopifyStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("isActive", true),
      )
      .first();

    if (shopifyStore) platforms.push("shopify");

    const metaSession = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("platform", "meta")
          .eq("isActive", true),
      )
      .first();

    if (metaSession) platforms.push("meta");

    // Check sync status for all connected platforms
    const completedSyncs = [];
    const pendingSyncs = [];
    const notStartedSyncs = [];

    for (const platform of platforms) {
      // Get the latest sync session for this platform using index ordering
      const latestSync = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_date", (q) =>
          q
            .eq("organizationId", user.organizationId as Id<"organizations">)
            .eq("platform", platform as "shopify" | "meta"),
        )
        .order("desc")
        .first();

      if (!latestSync) {
        notStartedSyncs.push(platform);
      } else if (latestSync.status === "completed") {
        completedSyncs.push(platform);
      } else if (
        latestSync.status === "syncing" ||
        latestSync.status === "pending"
      ) {
        pendingSyncs.push(platform);
      } else if (latestSync.status === "failed") {
        // Treat failed syncs as not started for retry
        notStartedSyncs.push(platform);
      }
    }

    // Trigger syncs for platforms that haven't started
    const syncJobs = [];
    const syncErrors = [];

    for (const platform of notStartedSyncs) {
      try {

        // Get account ID for Meta if needed
        let accountId: string | undefined;

        if (platform === "meta") {
          const primaryAccount = await ctx.db
            .query("metaAdAccounts")
            .withIndex("by_organization_and_isPrimary", (q) =>
              q
                .eq(
                  "organizationId",
                  user.organizationId as Id<"organizations">,
                )
                .eq("isPrimary", true),
            )
            .first();
          accountId = primaryAccount?.accountId;
        }

        // Create the sync job
        const jobId = await createJob(
          ctx,
          "sync:initial",
          PRIORITY.HIGH,
          {
            organizationId: user.organizationId as Id<"organizations">,
            platform: platform as "shopify" | "meta",
            accountId,
            dateRange: { daysBack: 60 },
          },
          {
            onComplete: internal.engine.syncJobs.onInitialSyncComplete as unknown,
            context: {
              organizationId: user.organizationId as Id<"organizations">,
              platform,
            },
          },
        );

        syncJobs.push({ platform, jobId });
      } catch (error) {
        console.error(
          `[ONBOARDING] Failed to trigger sync for ${platform}:`,
          error,
        );
        syncErrors.push({ platform, error: String(error) });
      }
    }

    // Check if all syncs are complete
    const allSyncsComplete =
      completedSyncs.length === platforms.length &&
      pendingSyncs.length === 0 &&
      notStartedSyncs.length === 0;

    // production: avoid verbose onboarding logs

    // Trigger analytics if all syncs are complete
    if (allSyncsComplete && platforms.length > 0) {

      await createJob(ctx, "analytics:calculate", PRIORITY.HIGH, {
        organizationId: user.organizationId as Id<"organizations">,
        syncType: "initial",
      });
    }

    // production: avoid PII in logs

    // Ensure a sync profile exists so ongoing cadence starts immediately
    try {
      const existingProfile = await ctx.db
        .query("syncProfiles")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", user.organizationId as Id<"organizations">),
        )
        .first();

      if (!existingProfile) {
        await ctx.db.insert("syncProfiles", {
          organizationId: user.organizationId as Id<"organizations">,
          activityScore: 20,
          lastActivityAt: Date.now(),
          activityHistory: [],
          syncFrequency: 4,
          syncInterval: 21600000, // 6 hours
          syncTier: "low",
          lastSync: undefined,
          nextScheduledSync: Date.now() + 10 * 60 * 1000, // 10 minutes after onboarding
          businessHoursEnabled: true,
          timezone: undefined,
          platformSettings: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.patch(existingProfile._id, {
          // kickstart cadence shortly after onboarding
          nextScheduledSync: Date.now() + 10 * 60 * 1000, // 10 minutes
          updatedAt: Date.now(),
        });
      }
    } catch (e) {
      console.warn("[ONBOARDING] Failed to upsert sync profile", e);
    }

    return {
      success: true,
      analyticsScheduled: allSyncsComplete || syncJobs.length > 0,
      platformsSyncing: platforms,
      syncJobs: syncJobs.length > 0 ? syncJobs : undefined,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
    };
  },
});

/**
 * Save initial cost setup for historical data
 */
export const saveInitialCosts = mutation({
  args: {
    cogsPercent: v.optional(v.number()),
    shippingCost: v.optional(v.number()),
    shippingMode: v.optional(v.union(v.literal("per_order"), v.literal("per_item"))),
    shippingPerItem: v.optional(v.number()),
    paymentFeePercent: v.optional(v.number()),
    paymentFixedFee: v.optional(v.number()),
    taxPercent: v.optional(v.number()),
    operatingCosts: v.optional(v.number()),
    handlingPerItem: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    nextStep: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    // Get or create onboarding record
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    const onboarding = await getOrCreateOnboarding(ctx, user._id, user.organizationId);

    if (!onboarding) {
      throw new Error("Failed to get onboarding record");
    }

    // If step 6 already completed, advance accordingly
    if (onboarding.onboardingStep === ONBOARDING_STEPS.COSTS && onboarding.isExtraCostSetup) {
      const nextStep = ONBOARDING_STEPS.COMPLETE;
      await ctx.db.patch(onboarding._id, { onboardingStep: nextStep, updatedAt: Date.now() });
      return { success: true, nextStep };
    }

    // Single source of truth: costs + per-variant components only (no historical defaults)

    // Create or update cost records for analytics (idempotent during onboarding)
    const now = Date.now();

    // Create COGS cost record if provided
    if (args.cogsPercent !== undefined && args.cogsPercent > 0) {
      const existingCOGS = await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q.eq("organizationId", user.organizationId as Id<"organizations">).eq("type", "product"),
        )
        .filter((q) => q.eq(q.field("name"), "Cost of Goods Sold"))
        .first();

      if (existingCOGS) {
        await ctx.db.patch(existingCOGS._id, {
          calculation: "percentage",
          value: args.cogsPercent,
          frequency: "percentage",
          isActive: true,
          isDefault: true,
          updatedAt: now,
        } as any);
      } else {
        await ctx.db.insert("costs", {
          organizationId: user.organizationId as Id<"organizations">,
          userId: user._id,
          type: "product",
          name: "Cost of Goods Sold",
          description: "Initial COGS percentage from onboarding",
          calculation: "percentage",
          value: args.cogsPercent,
          frequency: "percentage",
          applyTo: "all",
          isActive: true,
          isDefault: true,
          priority: 1,
          effectiveFrom: now,
          createdAt: now,
        } as any);
      }
    }

    // Create shipping cost record (per order or per item)
    if (args.shippingMode === "per_item") {
      if (args.shippingPerItem !== undefined && args.shippingPerItem > 0) {
        const existingPerItem = await ctx.db
          .query("costs")
          .withIndex("by_org_and_type", (q) =>
            q.eq("organizationId", user.organizationId as Id<"organizations">).eq("type", "shipping"),
          )
          .filter((q) => q.eq(q.field("frequency"), "per_item"))
          .first();

        if (existingPerItem) {
          await ctx.db.patch(existingPerItem._id, {
            calculation: "fixed",
            value: args.shippingPerItem,
            frequency: "per_item",
            isActive: true,
            isDefault: true,
            updatedAt: now,
          } as any);
        } else {
          await ctx.db.insert("costs", {
            organizationId: user.organizationId as Id<"organizations">,
            userId: user._id,
            type: "shipping",
            name: "Shipping Cost (per item)",
            description: "Initial shipping cost per item from onboarding",
            calculation: "fixed",
            value: args.shippingPerItem,
            frequency: "per_item",
            applyTo: "all",
            isActive: true,
            isDefault: true,
            priority: 1,
            effectiveFrom: now,
            createdAt: now,
          } as any);
        }
      }
    } else if (args.shippingCost !== undefined && args.shippingCost > 0) {
      const existingPerOrder = await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q.eq("organizationId", user.organizationId as Id<"organizations">).eq("type", "shipping"),
        )
        .filter((q) => q.eq(q.field("frequency"), "per_order"))
        .first();

      if (existingPerOrder) {
        await ctx.db.patch(existingPerOrder._id, {
          calculation: "fixed",
          value: args.shippingCost,
          frequency: "per_order",
          isActive: true,
          isDefault: true,
          updatedAt: now,
        } as any);
      } else {
        await ctx.db.insert("costs", {
          organizationId: user.organizationId as Id<"organizations">,
          userId: user._id,
          type: "shipping",
          name: "Shipping Cost",
          description: "Initial shipping cost from onboarding",
          calculation: "fixed",
          value: args.shippingCost,
          frequency: "per_order",
          applyTo: "all",
          isActive: true,
          isDefault: true,
          priority: 1,
          effectiveFrom: now,
          createdAt: now,
        } as any);
      }
    }

    // Create payment fee record if provided
    if (args.paymentFeePercent !== undefined && args.paymentFeePercent > 0) {
      const existingPayment = await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q.eq("organizationId", user.organizationId as Id<"organizations">).eq("type", "payment"),
        )
        .first();

      if (existingPayment) {
        await ctx.db.patch(existingPayment._id, {
          calculation: "percentage",
          value: args.paymentFeePercent,
          frequency: "percentage",
          isActive: true,
          isDefault: true,
          updatedAt: now,
          config: args.paymentFixedFee ? { fixedFee: args.paymentFixedFee } : existingPayment.config,
        } as any);
      } else {
        await ctx.db.insert("costs", {
          organizationId: user.organizationId as Id<"organizations">,
          userId: user._id,
          type: "payment",
          name: "Payment Processing Fee",
          description: "Initial payment fee percentage from onboarding",
          calculation: "percentage",
          value: args.paymentFeePercent,
          frequency: "percentage",
          config: args.paymentFixedFee ? { fixedFee: args.paymentFixedFee } : undefined,
          applyTo: "all",
          isActive: true,
          isDefault: true,
          priority: 1,
          effectiveFrom: now,
          createdAt: now,
        } as any);
      }
    }

    // Create or update tax record if provided (avoid duplicates)
    if (args.taxPercent !== undefined && args.taxPercent > 0) {
      const existingTax = await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q
            .eq("organizationId", user.organizationId as Id<"organizations">)
            .eq("type", "tax"),
        )
        .first();

      if (existingTax) {
        await ctx.db.patch(existingTax._id, {
          calculation: "percentage",
          value: args.taxPercent,
          frequency: "percentage",
          isActive: true,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("costs", {
          organizationId: user.organizationId,
          userId: user._id,
          type: "tax",
          name: "Sales Tax",
          description: "Initial tax percentage from onboarding",
          calculation: "percentage",
          value: args.taxPercent,
          frequency: "percentage",
          applyTo: "all",
          isActive: true,
          isDefault: true,
          priority: 1,
          effectiveFrom: now,
          createdAt: Date.now(),
        });
      }
    }

    // Create operating costs record if provided
    if (args.operatingCosts !== undefined && args.operatingCosts > 0) {
      const existingOp = await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q.eq("organizationId", user.organizationId as Id<"organizations">).eq("type", "operational"),
        )
        .filter((q) => q.eq(q.field("frequency"), "monthly"))
        .first();

      if (existingOp) {
        await ctx.db.patch(existingOp._id, {
          calculation: "fixed",
          value: args.operatingCosts,
          frequency: "monthly",
          isActive: true,
          isDefault: true,
          updatedAt: now,
        } as any);
      } else {
        await ctx.db.insert("costs", {
          organizationId: user.organizationId,
          userId: user._id,
          type: "operational",
          name: "Operating Costs",
          description: "Initial monthly operating costs from onboarding",
          calculation: "fixed",
          value: args.operatingCosts,
          frequency: "monthly",
          applyTo: "all",
          isActive: true,
          isDefault: true,
          priority: 1,
          effectiveFrom: now,
          createdAt: now,
        } as any);
      }
    }

    // Optional: handling per item default
    if (args.handlingPerItem !== undefined && args.handlingPerItem > 0) {
      const existingHandling = await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q.eq("organizationId", user.organizationId as Id<"organizations">).eq("type", "handling"),
        )
        .filter((q) => q.eq(q.field("frequency"), "per_item"))
        .first();

      if (existingHandling) {
        await ctx.db.patch(existingHandling._id, {
          calculation: "fixed",
          value: args.handlingPerItem,
          frequency: "per_item",
          isActive: true,
          isDefault: true,
          updatedAt: now,
        } as any);
      } else {
        await ctx.db.insert("costs", {
          organizationId: user.organizationId as Id<"organizations">,
          userId: user._id,
          type: "handling",
          name: "Handling (per item)",
          description: "Initial handling/overhead cost per item from onboarding",
          calculation: "fixed",
          value: args.handlingPerItem,
          frequency: "per_item",
          applyTo: "all",
          isActive: true,
          isDefault: true,
          priority: 1,
          effectiveFrom: now,
          createdAt: now,
        } as any);
      }
    }

    // Update onboarding record without moving backwards.
    // If the user is at or beyond the COSTS step, advance to COMPLETE; otherwise keep current step.
    const advanceToComplete = (onboarding.onboardingStep || 1) >= ONBOARDING_STEPS.COSTS;
    const actualNextStep = advanceToComplete
      ? ONBOARDING_STEPS.COMPLETE
      : (onboarding.onboardingStep || ONBOARDING_STEPS.MARKETING);
    await ctx.db.patch(onboarding._id, {
      isExtraCostSetup: true,
      onboardingStep: actualNextStep,
      updatedAt: Date.now(),
    });

    // production: avoid noisy onboarding logs

    return {
      success: true,
      nextStep: actualNextStep,
    };
  },
});

/**
 * Skip initial cost setup
 */

/**
 * Get products for cost mapping with pagination
 */

/**
 * Complete billing step during onboarding
 */
export const completeBillingStep = mutation({
  args: {
    selectedPlan: v.optional(v.string()),
    skipBilling: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    nextStep: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    // Do not mark subscription or set plan here.
    // Plans (including Free) must be selected in Shopify and confirmed via webhooks.

    // Move to costs setup - update onboarding record instead
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    const onboarding = await getOrCreateOnboarding(
      ctx,
      user._id,
      user.organizationId,
    );

    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        // Billing completed; advance to Marketing step
        onboardingStep: ONBOARDING_STEPS.MARKETING,
        updatedAt: Date.now(),
      });
    }

    // production: avoid noisy onboarding logs

    return {
      success: true,
      // Advance to MARKETING after billing
      nextStep: ONBOARDING_STEPS.MARKETING,
    };
  },
});

/**
 * Skip onboarding step
 */
export const skipOnboardingStep = mutation({
  args: {
    step: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    nextStep: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    // Move to next step - update onboarding record instead
    const nextStep = args.step + 1;
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    const onboarding = await getOrCreateOnboarding(
      ctx,
      user._id,
      user.organizationId,
    );

    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        onboardingStep: nextStep,
        onboardingData: {
          ...onboarding.onboardingData,
          completedSteps: onboarding.onboardingData?.completedSteps || [],
        },
        updatedAt: Date.now(),
      });
    }

    return {
      success: true,
      nextStep,
    };
  },
});

/**
 * Connect Shopify store during onboarding
 */
export const connectShopifyStore = mutation({
  args: {
    domain: v.string(),
    accessToken: v.string(),
    scope: v.string(),
    shopData: v.optional(
      v.object({
        email: v.optional(v.string()),
        shopName: v.optional(v.string()),
        currency: v.optional(v.string()),
        timezone: v.optional(v.string()),
        country: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    organizationId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    // Normalize the domain and check if store already exists
    const domain = normalizeShopDomain(args.domain);
    const existingStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", domain))
      .first();

    const storeName = args.shopData?.shopName || domain;
    const currency = args.shopData?.currency || "USD";

    if (existingStore) {
      // Prevent reassigning a store connected to another organization
      if (
        existingStore.organizationId &&
        user.organizationId &&
        existingStore.organizationId !== (user.organizationId as Id<"organizations">)
      ) {
        throw new Error("This Shopify store is already connected to another organization.");
      }
      // Reactivate existing store
      await ctx.db.patch(existingStore._id, {
        organizationId: user.organizationId,
        accessToken: args.accessToken,
        scope: args.scope,
        storeName: storeName,
        primaryCurrency: currency,
        operatingCountry: args.shopData?.country,
        isActive: true,
        updatedAt: Date.now(),
      });
    } else {
      // Create new store
      await ctx.db.insert("shopifyStores", {
        organizationId: user.organizationId as Id<"organizations">,
        userId: user._id,
        shopDomain: domain,
        storeName: storeName,
        accessToken: args.accessToken,
        scope: args.scope,
        primaryCurrency: currency,
        operatingCountry: args.shopData?.country,
        isActive: true,
      });
    }

    // Initialize trial for store organizations if needed
    const organization = await ctx.db.get(
      user.organizationId as Id<"organizations">,
    );

    if (organization) {
      // Initialize trial for store organizations
      const now = Date.now();
      const needsTrialInit =
        !organization.trialStartDate ||
        (organization.trialStartDate && organization.hasTrialExpired);

      if (needsTrialInit) {
        const trialEndDate = now + 14 * 24 * 60 * 60 * 1000; // 14 days from now

        await ctx.db.patch(user.organizationId as Id<"organizations">, {
          trialStartDate: now,
          trialEndDate: trialEndDate,
          isTrialActive: true,
          hasTrialExpired: false,
          updatedAt: Date.now(),
        });

        console.log(
          `[ONBOARDING] Initialized 14-day trial for store organization ${user.organizationId as Id<"organizations">}`,
        );
      } else {
        console.log(
          `[ONBOARDING] Trial already active for organization ${user.organizationId as Id<"organizations">}`,
        );
      }
    }

    // Ensure organization timezone is set if we received a valid IANA timezone during connect
    try {
      const tz = args.shopData?.timezone;
      if (tz && isIanaTimeZone(tz) && user.organizationId) {
        const org = await ctx.db.get(user.organizationId as Id<"organizations">);
        if (org && !org.timezone) {
          await ctx.db.patch(user.organizationId as Id<"organizations">, {
            timezone: tz,
            updatedAt: Date.now(),
          });
        }
      }
    } catch (e) {
      console.warn("[ONBOARDING] timezone set skipped", e);
    }

    // Update user with primary currency from shop
    // Determine next step: If trial is active, skip billing and go to costs
    // If trial has expired, go to billing step
    // Remain on SHOPIFY step for sub-steps (billing/costs) to align with UI enums
    const nextStep = ONBOARDING_STEPS.BILLING;

    // Get or create onboarding record
    const onboarding = await getOrCreateOnboarding(
      ctx,
      user._id,
      user.organizationId as Id<"organizations">,
    );

    if (!onboarding) {
      throw new Error("Failed to get onboarding record");
    }

    // Update onboarding progress
    const completedSteps = onboarding.onboardingData?.completedSteps || [];

    if (!completedSteps.includes("shopify")) {
      completedSteps.push("shopify");
    }

    interface OnboardingUpdateData {
      onboardingStep: number;
      hasShopifyConnection: boolean;
      onboardingData: {
        completedSteps: string[];
        setupDate?: string;
        referralSource?: string;
      };
      updatedAt: number;
    }

    const onboardingUpdates: OnboardingUpdateData = {
      onboardingStep: nextStep,
      hasShopifyConnection: true,
      onboardingData: {
        ...onboarding.onboardingData,
        completedSteps,
      },
      updatedAt: Date.now(),
    };

    await ctx.db.patch(onboarding._id, onboardingUpdates);

    // Update user's primary currency from Shopify store
    interface UserUpdateData {
      updatedAt: number;
      primaryCurrency?: string;
    }

    const userUpdates: UserUpdateData = {
      updatedAt: Date.now(),
    };

    if (args.shopData?.currency) {
      userUpdates.primaryCurrency = args.shopData.currency;
      console.log(
        `[ONBOARDING] Setting user ${user.email} primary currency to ${args.shopData.currency} from Shopify store`,
      );
    }

    await ctx.db.patch(user._id, userUpdates);

    console.log(
      `[ONBOARDING] Successfully connected Shopify store for ${user.email}. Sync will be triggered by callback.`,
    );

    return {
      success: true,
      organizationId: user.organizationId as Id<"organizations">,
    };
  },
});

// (Removed unused internal mutations: resetOnboarding, needsOnboarding)
