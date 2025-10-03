import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { ensureActiveMembership } from "../authHelpers";
import { createJob, PRIORITY } from "../engine/workpool";
import { normalizeShopDomain } from "../utils/shop";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";
import { buildDateSpan } from "../utils/date";
import { optionalEnv } from "../utils/env";
import { isIanaTimeZone } from "@repo/time";
import { ONBOARDING_STEPS } from "@repo/types";

/**
 * Onboarding flow management
 * Handles the 5-step onboarding process and triggers initial 60-day sync
 */

const FIRECRAWL_SEED_URL = null;
const IS_PRODUCTION_ENVIRONMENT = process.env.NODE_ENV === "production";
const DEV_FIRECRAWL_TEST_URL = "https://shopcelestia.in/";

type SyncSessionStatus = Doc<"syncSessions">["status"];

const ACTIVE_SYNC_STATUSES = new Set<SyncSessionStatus>([
  "pending",
  "processing",
  "syncing",
]);

const INITIAL_STATUS_SEARCH_ORDER: SyncSessionStatus[] = [
  "pending",
  "processing",
  "syncing",
  "failed",
  "completed",
];

const isInitialSyncSession = (session: Doc<"syncSessions">): boolean =>
  session.type === "initial" || session.metadata?.isInitialSync === true;

const hasInitialSessionWithStatus = async (
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  platform: "shopify" | "meta",
  status: SyncSessionStatus,
): Promise<boolean> => {
  let cursor: string | undefined;

  while (true) {
    const page = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("platform", platform)
          .eq("status", status),
      )
      .order("desc")
      .paginate({
        cursor: cursor ?? null,
        numItems: 100,
      });

    for (const session of page.page) {
      if (isInitialSyncSession(session)) {
        return true;
      }
    }

    if (page.isDone) {
      return false;
    }

    if (page.continueCursor === undefined) {
      return false;
    }

    cursor = page.continueCursor;
  }
};

const findInitialSyncStatusFlags = async (
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  platform: "shopify" | "meta",
): Promise<
  | {
      hasActive: boolean;
      hasFailed: boolean;
      hasCompleted: boolean;
    }
  | null
> => {
  let hasActive = false;
  let hasFailed = false;
  let hasCompleted = false;

  for (const status of INITIAL_STATUS_SEARCH_ORDER) {
    const matchesStatus = await hasInitialSessionWithStatus(
      ctx,
      organizationId,
      platform,
      status,
    );

    if (!matchesStatus) {
      continue;
    }

    if (ACTIVE_SYNC_STATUSES.has(status)) {
      hasActive = true;
      break;
    }

    if (status === "failed") {
      hasFailed = true;
      continue;
    }

    if (status === "completed") {
      hasCompleted = true;
    }
  }

  if (!hasActive && !hasFailed && !hasCompleted) {
    return null;
  }

  return { hasActive, hasFailed, hasCompleted };
};

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
      isInitialSyncComplete: v.boolean(),
      pendingSyncPlatforms: v.optional(v.array(v.string())),
      analyticsTriggeredAt: v.optional(v.number()),
      lastSyncCheckAt: v.optional(v.number()),
      syncCheckAttempts: v.optional(v.number()),
      syncStatus: v.object({
        shopify: v.optional(
          v.object({
            status: v.string(),
            overallState: v.optional(
              v.union(
                v.literal("unsynced"),
                v.literal("syncing"),
                v.literal("complete"),
                v.literal("failed"),
              ),
            ),
            recordsProcessed: v.optional(v.number()),
            baselineRecords: v.optional(v.number()),
            ordersProcessed: v.optional(v.number()),
            ordersQueued: v.optional(v.number()),
            totalOrdersSeen: v.optional(v.number()),
            productsProcessed: v.optional(v.number()),
            customersProcessed: v.optional(v.number()),
            startedAt: v.optional(v.number()),
            completedAt: v.optional(v.number()),
            lastError: v.optional(v.string()),
            stageStatus: v.optional(
              v.object({
                products: v.optional(v.string()),
                inventory: v.optional(v.string()),
                customers: v.optional(v.string()),
                orders: v.optional(v.string()),
              }),
            ),
            syncedEntities: v.optional(v.array(v.string())),
          }),
        ),
        meta: v.optional(
          v.object({
            status: v.string(),
            overallState: v.optional(
              v.union(
                v.literal("unsynced"),
                v.literal("syncing"),
                v.literal("complete"),
                v.literal("failed"),
              ),
            ),
            recordsProcessed: v.optional(v.number()),
            startedAt: v.optional(v.number()),
            completedAt: v.optional(v.number()),
            lastError: v.optional(v.string()),
          }),
        ),
      }),
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

    // Prefer the most recent initial sync session for progress display
    const recentShopifySessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", orgId)
          .eq("platform", "shopify"),
      )
      .order("desc")
      .take(20);
    const latestShopifyInitial = recentShopifySessions.find((s) =>
      isInitialSyncSession(s as any),
    );
    const latestShopifySession = latestShopifyInitial || recentShopifySessions[0];

    const recentMetaSessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", orgId)
          .eq("platform", "meta"),
      )
      .order("desc")
      .take(20);
    const latestMetaInitial = recentMetaSessions.find((s) =>
      isInitialSyncSession(s as any),
    );
    const latestMetaSession = latestMetaInitial || recentMetaSessions[0];

    // Compute overallState for each platform with initial sync awareness
    const computeOverall = async (
      platform: "shopify" | "meta",
    ): Promise<"unsynced" | "syncing" | "complete" | "failed"> => {
      // Check completed initial
      const completed = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("platform", platform)
            .eq("status", "completed"),
        )
        .take(10);
      if (completed.find((s) => s.type === "initial" || (s.metadata as any)?.isInitialSync === true)) {
        return "complete";
      }
      // Check active initial
      const actives = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("platform", platform)
            .eq("status", "pending"),
        )
        .take(10);
      const syncing = actives.find((s) => s.type === "initial")
        ? true
        : (await ctx.db
            .query("syncSessions")
            .withIndex("by_org_platform_and_status", (q) =>
              q
                .eq("organizationId", orgId)
                .eq("platform", platform)
                .eq("status", "processing"),
            )
            .take(10)).find((s) => s.type === "initial")
          ? true
          : (await ctx.db
              .query("syncSessions")
              .withIndex("by_org_platform_and_status", (q) =>
                q
                  .eq("organizationId", orgId)
                  .eq("platform", platform)
                  .eq("status", "syncing"),
              )
              .take(10)).find((s) => s.type === "initial")
            ? true
            : false;
      if (syncing) return "syncing";
      // Check failed initial
      const failed = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("platform", platform)
            .eq("status", "failed"),
        )
        .take(10);
      if (failed.find((s) => s.type === "initial")) {
        return "failed";
      }
      return "unsynced";
    };

    let shopifyOverall = await computeOverall("shopify");
    const metaOverall = await computeOverall("meta");

    const shopifyMetadata = (latestShopifySession?.metadata || {}) as Record<
      string,
      unknown
    >;
    const shopifyStageStatus = shopifyMetadata.stageStatus as
      | Record<string, string>
      | undefined;
    const shopifySyncedEntities = Array.isArray(shopifyMetadata.syncedEntities)
      ? (shopifyMetadata.syncedEntities as string[])
      : undefined;
    const shopifyBaselineRecords =
      typeof shopifyMetadata.baselineRecords === "number"
        ? (shopifyMetadata.baselineRecords as number)
        : undefined;
    const shopifyOrdersProcessed =
      typeof shopifyMetadata.ordersProcessed === "number"
        ? (shopifyMetadata.ordersProcessed as number)
        : undefined;
    const shopifyOrdersQueued =
      typeof shopifyMetadata.ordersQueued === "number"
        ? (shopifyMetadata.ordersQueued as number)
        : undefined;
    const shopifyProductsProcessed =
      typeof shopifyMetadata.productsProcessed === "number"
        ? (shopifyMetadata.productsProcessed as number)
        : undefined;
    const shopifyCustomersProcessed =
      typeof shopifyMetadata.customersProcessed === "number"
        ? (shopifyMetadata.customersProcessed as number)
        : undefined;
    const shopifyTotalOrdersSeen =
      typeof shopifyMetadata.totalOrdersSeen === "number"
        ? (shopifyMetadata.totalOrdersSeen as number)
        : undefined;

    const normalizedOrdersProcessed =
      shopifyOrdersProcessed !== undefined
        ? shopifyOrdersProcessed
        : shopifyBaselineRecords !== undefined &&
            typeof latestShopifySession?.recordsProcessed === "number"
          ? Math.max(
              0,
              (latestShopifySession.recordsProcessed || 0) -
                shopifyBaselineRecords,
            )
          : undefined;

    // Heuristic DB-backed completion: if DB has >= expected orders, consider complete
    const expectedOrders =
      shopifyTotalOrdersSeen !== undefined
        ? shopifyTotalOrdersSeen
        : shopifyOrdersQueued !== undefined
          ? shopifyOrdersQueued
          : undefined;
    let dbHasExpectedOrders = false;
    if (expectedOrders !== undefined && expectedOrders > 0) {
      const limit = Math.min(Math.max(expectedOrders - 2 + 5, 500), 5000);
      const slice = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .take(limit);
      dbHasExpectedOrders = slice.length >= Math.max(0, expectedOrders - 2);
    }

    return {
      completed: onboarding.isCompleted || false,
      currentStep: onboarding.onboardingStep || 1,
      completedSteps: onboarding.onboardingData?.completedSteps || [],
      connections,
      hasShopifySubscription: onboarding.hasShopifySubscription || false,
      isProductCostSetup: onboarding.isProductCostSetup || false,
      isExtraCostSetup: onboarding.isExtraCostSetup || false,
      isInitialSyncComplete: onboarding.isInitialSyncComplete || false,
      pendingSyncPlatforms:
        onboarding.onboardingData?.syncPendingPlatforms || undefined,
      analyticsTriggeredAt:
        onboarding.onboardingData?.analyticsTriggeredAt || undefined,
      lastSyncCheckAt: onboarding.onboardingData?.lastSyncCheckAt || undefined,
      syncCheckAttempts: onboarding.onboardingData?.syncCheckAttempts || undefined,
      syncStatus: {
        shopify: latestShopifySession
          ? {
              status: latestShopifySession.status,
              overallState: (() => {
                // Heuristic: if orders stage is complete or processed >= queued, treat as complete
                const stagesComplete = Boolean(
                  shopifyStageStatus &&
                    shopifyStageStatus.orders === "completed" &&
                    shopifyStageStatus.products === "completed" &&
                    shopifyStageStatus.inventory === "completed" &&
                    shopifyStageStatus.customers === "completed",
                );
                const countsComplete = Boolean(
                  typeof shopifyOrdersQueued === "number" &&
                    typeof normalizedOrdersProcessed === "number" &&
                    shopifyOrdersQueued >= 0 &&
                    normalizedOrdersProcessed >= shopifyOrdersQueued,
                );
                if (stagesComplete || countsComplete || dbHasExpectedOrders) {
                  shopifyOverall = "complete";
                }
                return shopifyOverall;
              })(),
              recordsProcessed: latestShopifySession.recordsProcessed,
              baselineRecords: shopifyBaselineRecords,
              ordersProcessed: normalizedOrdersProcessed,
              ordersQueued: shopifyOrdersQueued,
              totalOrdersSeen: shopifyTotalOrdersSeen,
              productsProcessed: shopifyProductsProcessed,
              customersProcessed: shopifyCustomersProcessed,
              startedAt: latestShopifySession.startedAt,
              completedAt: latestShopifySession.completedAt,
              lastError: latestShopifySession.error,
              stageStatus: shopifyStageStatus
                ? {
                    products: shopifyStageStatus.products,
                    inventory: shopifyStageStatus.inventory,
                    customers: shopifyStageStatus.customers,
                    orders: shopifyStageStatus.orders,
                  }
                : undefined,
              syncedEntities: shopifySyncedEntities,
            }
          : undefined,
        meta: latestMetaSession
          ? {
              status: latestMetaSession.status,
              overallState: metaOverall,
              recordsProcessed: latestMetaSession.recordsProcessed,
              startedAt: latestMetaSession.startedAt,
              completedAt: latestMetaSession.completedAt,
              lastError: latestMetaSession.error,
            }
          : undefined,
      },
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
    mobileNumber: v.optional(v.string()),
    mobileCountryCode: v.optional(v.string()),
    referralSource: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    // production: avoid noisy onboarding logs

    const userUpdates: { updatedAt: number; phone?: string } = {
      updatedAt: Date.now(),
    };

    if (args.mobileNumber !== undefined) {
      userUpdates.phone = args.mobileNumber;
    }

    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    if (args.organizationName !== undefined) {
      await ctx.db.patch(user.organizationId, {
        name: args.organizationName,
        updatedAt: Date.now(),
      });
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
          mobileCountryCode: args.mobileCountryCode ?? onboarding.onboardingData?.mobileCountryCode,
        },
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(user._id, userUpdates);

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
 * Join demo organization for trial experience
 */
export const joinDemoOrganization = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const demoOrgEnv = optionalEnv("DEMO_ORG");
    if (!demoOrgEnv) {
      return {
        success: false,
        message: "Demo organization is not configured yet.",
      };
    }

    const { user, orgId: currentOrgId } = await requireUserAndOrg(ctx);

    const demoOrgId = demoOrgEnv as Id<"organizations">;
    if (currentOrgId === demoOrgId) {
      return {
        success: true,
        message: "You already have access to the demo organization.",
      };
    }

    const demoOrg = await ctx.db.get(demoOrgId);
    if (!demoOrg) {
      return {
        success: false,
        message: "Demo organization is unavailable right now.",
      };
    }

    const now = Date.now();

    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", currentOrgId).eq("userId", user._id),
      )
      .first();

    if (existingMembership && existingMembership.status !== "removed") {
      await ctx.db.patch(existingMembership._id, {
        status: "removed",
        updatedAt: now,
      });
    }

    await ctx.db.patch(user._id, {
      organizationId: demoOrgId,
      role: "StoreTeam",
      status: "active",
      isOnboarded: true,
      lastLoginAt: now,
      updatedAt: now,
    });

    await ensureActiveMembership(ctx, demoOrgId, user._id, "StoreTeam", {
      seatType: existingMembership?.seatType ?? "free",
      hasAiAddOn: existingMembership?.hasAiAddOn ?? false,
      assignedAt: now,
      assignedBy: demoOrg.ownerId,
    });

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const demoStepOrder = [
      "shopify",
      "billing",
      "marketing",
      "accounts",
      "products",
      "cost",
      "complete",
    ];

    const completedStepsSet = new Set(
      onboarding?.onboardingData?.completedSteps ?? [],
    );
    for (const step of demoStepOrder) {
      completedStepsSet.add(step);
    }

    const onboardingData = {
      ...onboarding?.onboardingData,
      completedSteps: demoStepOrder.filter((step) =>
        completedStepsSet.has(step),
      ),
      setupDate:
        onboarding?.onboardingData?.setupDate ?? new Date().toISOString(),
    };

    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        organizationId: demoOrgId,
        onboardingStep: ONBOARDING_STEPS.COMPLETE,
        isCompleted: true,
        hasShopifyConnection: true,
        hasShopifySubscription: true,
        hasMetaConnection: true,
        isInitialSyncComplete: true,
        isProductCostSetup: true,
        isExtraCostSetup: true,
        onboardingData,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("onboarding", {
        userId: user._id,
        organizationId: demoOrgId,
        onboardingStep: ONBOARDING_STEPS.COMPLETE,
        isCompleted: true,
        hasShopifyConnection: true,
        hasShopifySubscription: true,
        hasMetaConnection: true,
        isInitialSyncComplete: true,
        isProductCostSetup: true,
        isExtraCostSetup: true,
        onboardingData,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      message: "Demo organization enabled. Explore Meyoo with sample data.",
    };
  },
});

/**
 * Complete onboarding and trigger initial sync
 */
type CompleteOnboardingResult = {
  success: boolean;
  analyticsScheduled: boolean;
  platformsSyncing: string[];
  syncJobs?: { platform: string; jobId: string }[];
  syncErrors?: { platform: string; error: string }[];
};

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
  handler: async (ctx): Promise<CompleteOnboardingResult> => {
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

        if (platform === "shopify") {
          const ensure = (await ctx.runMutation(
            internal.engine.syncJobs.ensureInitialSync,
            {
              organizationId: user.organizationId as Id<"organizations">,
              platform: "shopify",
              dateRange: { daysBack: 60 },
            },
          )) as {
            enqueued: boolean;
            sessionId: Id<"syncSessions">;
            status: string;
            jobId?: string;
          };

          if (ensure.jobId) {
            syncJobs.push({ platform, jobId: ensure.jobId });
          }
        } else {
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
              onComplete:
                internal.engine.syncJobs.onInitialSyncComplete as unknown,
              context: {
                organizationId: user.organizationId as Id<"organizations">,
                platform,
              },
            },
          );

          syncJobs.push({ platform, jobId });
        }
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

    const now = Date.now();
    const pendingPlatformsList = Array.from(
      new Set([...pendingSyncs, ...notStartedSyncs]),
    );

    const onboardingData: Record<string, any> = {
      ...onboarding.onboardingData,
      syncCheckAttempts: 0,
      lastSyncCheckAt: now,
    };

    if (pendingPlatformsList.length > 0) {
      onboardingData.syncPendingPlatforms = pendingPlatformsList;
    } else {
      delete onboardingData.syncPendingPlatforms;
    }

    await ctx.db.patch(onboarding._id, {
      isCompleted: true,
      onboardingStep: ONBOARDING_STEPS.COMPLETE,
      isInitialSyncComplete: allSyncsComplete,
      onboardingData,
      updatedAt: now,
    });

    // Update integration status snapshot (best-effort)
    try {
      await ctx.runMutation(internal.core.status.refreshIntegrationStatus, {
        organizationId: user.organizationId as Id<"organizations">,
      });
    } catch (_error) {
      // non-fatal
    }

    await ctx.db.patch(user._id, {
      isOnboarded: true,
      updatedAt: now,
    });

    return {
      success: true,
      analyticsScheduled: false,
      platformsSyncing: pendingPlatformsList,
      syncJobs: syncJobs.length > 0 ? syncJobs : undefined,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
    };
  },
});

export const monitorInitialSyncs = internalMutation({
  args: {
    limit: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.object({
    checked: v.number(),
    completed: v.number(),
    analyticsTriggered: v.number(),
    pending: v.number(),
  }),
  handler: async (ctx, args) => {
    const limitArg = args.limit ?? 25;
    const limit = Math.min(Math.max(limitArg, 1), 100);

    const candidates = await (async () => {
      if (args.organizationId) {
        return await ctx.db
          .query("onboarding")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId as Id<"organizations">),
          )
          .take(limit);
      }

      return await ctx.db
        .query("onboarding")
        .withIndex("by_completed", (q) => q.eq("isCompleted", true))
        .take(limit * 2);
    })();

    let processed = 0;
    let completedCount = 0;
    const analyticsCount = 0;
    let pendingCount = 0;

    // Heal sync sessions that imported data but never flipped to "completed" so onboarding can finish.
    const attemptFinalizeSession = async (
      session: Doc<"syncSessions">,
    ): Promise<
      | {
          finalized: true;
          normalizedOrdersProcessed?: number;
        }
      | { finalized: false }
    > => {
      if (session.status === "completed") {
        return { finalized: true };
      }

      const isActivelySyncing =
        (session.status === "processing" || session.status === "syncing") &&
        Date.now() - session.startedAt < 2 * 60 * 1000;
      if (isActivelySyncing) {
        return { finalized: false };
      }

      const metadata = (session.metadata || {}) as Record<string, any>;
      const totalBatches =
        typeof metadata.totalBatches === "number"
          ? metadata.totalBatches
          : undefined;
      const completedBatches =
        typeof metadata.completedBatches === "number"
          ? metadata.completedBatches
          : undefined;
      const ordersQueued =
        typeof metadata.ordersQueued === "number"
          ? metadata.ordersQueued
          : undefined;
      const ordersProcessedMeta =
        typeof metadata.ordersProcessed === "number"
          ? metadata.ordersProcessed
          : undefined;
      const baselineRecords =
        typeof metadata.baselineRecords === "number"
          ? metadata.baselineRecords
          : undefined;
      const recordsProcessed =
        typeof session.recordsProcessed === "number"
          ? session.recordsProcessed
          : undefined;

      const normalizedOrdersProcessed =
        ordersProcessedMeta !== undefined
          ? ordersProcessedMeta
          : baselineRecords !== undefined && recordsProcessed !== undefined
            ? Math.max(0, recordsProcessed - baselineRecords)
            : undefined;

      const stageStatus = metadata.stageStatus as
        | Record<string, string>
        | undefined;

      const isBatchesComplete =
        totalBatches !== undefined &&
        completedBatches !== undefined &&
        totalBatches > 0 &&
        completedBatches >= totalBatches;
      const isOrdersComplete =
        ordersQueued !== undefined &&
        normalizedOrdersProcessed !== undefined &&
        ordersQueued >= 0 &&
        normalizedOrdersProcessed >= ordersQueued;
      const isStagesComplete = Boolean(
        stageStatus &&
          stageStatus.orders === "completed" &&
          stageStatus.products === "completed" &&
          stageStatus.inventory === "completed" &&
          stageStatus.customers === "completed",
      );

      if (!isBatchesComplete && !isOrdersComplete && !isStagesComplete) {
        return { finalized: false };
      }

      const nextMetadata: Record<string, any> = { ...metadata };

      if (stageStatus) {
        nextMetadata.stageStatus = {
          ...stageStatus,
          orders: "completed",
        };
      }

      if (normalizedOrdersProcessed !== undefined) {
        nextMetadata.ordersProcessed = normalizedOrdersProcessed;
      }

      if (totalBatches !== undefined) {
        nextMetadata.totalBatches = totalBatches;
      }

      if (completedBatches !== undefined) {
        nextMetadata.completedBatches = Math.min(
          completedBatches,
          totalBatches ?? completedBatches,
        );
      }

      const syncedEntities = Array.isArray(metadata.syncedEntities)
        ? new Set(metadata.syncedEntities as string[])
        : new Set<string>();
      syncedEntities.add("orders");
      nextMetadata.syncedEntities = Array.from(syncedEntities);

      await ctx.db.patch(session._id, {
        status: "completed",
        completedAt: session.completedAt ?? Date.now(),
        recordsProcessed:
          recordsProcessed ??
          normalizedOrdersProcessed ??
          ordersQueued ??
          0,
        metadata: nextMetadata,
      });

      return { finalized: true, normalizedOrdersProcessed };
    };

    for (const onboarding of candidates) {
      if (processed >= limit) break;
      if (!onboarding.organizationId) continue;
      if (onboarding.isInitialSyncComplete) continue;

      processed += 1;

      try {
        const orgId = onboarding.organizationId as Id<"organizations">;
        const platforms: ("shopify" | "meta")[] = [];

        if (onboarding.hasShopifyConnection) {
          platforms.push("shopify");
        }

        if (onboarding.hasMetaConnection) {
          const metaSession = await ctx.db
            .query("integrationSessions")
            .withIndex("by_org_platform_and_status", (q) =>
              q
                .eq("organizationId", orgId)
                .eq("platform", "meta")
                .eq("isActive", true),
            )
            .first();

          if (metaSession) {
            platforms.push("meta");
          }
        }

        const now = Date.now();
        const previousAttempts =
          onboarding.onboardingData?.syncCheckAttempts ?? 0;
        const previousPending = new Set(
          Array.isArray(onboarding.onboardingData?.syncPendingPlatforms)
            ? onboarding.onboardingData?.syncPendingPlatforms
            : [],
        );
        const onboardingData: Record<string, any> = {
          ...onboarding.onboardingData,
        };
        const wasComplete = onboarding.isInitialSyncComplete;
        let appliedUpdate = false;
        let justCompleted = false;

        if (platforms.length === 0) {
          const hadPending = previousPending.size > 0;
          if (!wasComplete || hadPending) {
            delete onboardingData.syncPendingPlatforms;
            onboardingData.syncCheckAttempts = previousAttempts + 1;
            onboardingData.lastSyncCheckAt = now;

            await ctx.db.patch(onboarding._id, {
              isInitialSyncComplete: true,
              onboardingData,
              updatedAt: now,
            });

            appliedUpdate = true;
            justCompleted = !wasComplete;
          }

          completedCount += 1;
          continue;
        }

        const completedPlatforms = new Set<string>();
        const pendingPlatforms = new Set<string>();

        for (const platform of platforms) {
          const sessions = await ctx.db
            .query("syncSessions")
            .withIndex("by_org_platform_and_date", (q) =>
              q.eq("organizationId", orgId).eq("platform", platform),
            )
            .order("desc")
            .take(10);

          const initialSessions = sessions.filter(isInitialSyncSession);

          let hasActive = initialSessions.some((session) =>
            ACTIVE_SYNC_STATUSES.has(session.status),
          );
          let hasFailed = initialSessions.some(
            (session) => session.status === "failed",
          );
          let hasCompleted = initialSessions.some(
            (session) => session.status === "completed",
          );

          if (!hasCompleted && initialSessions.length > 0) {
            const [latestInitial] = initialSessions;

            if (latestInitial) {
              const finalizeResult = await attemptFinalizeSession(latestInitial);

              if (finalizeResult.finalized) {
                hasCompleted = true;
                hasActive = false;
                hasFailed = false;
              }
            }
          }

          if (!hasActive && !hasFailed && !hasCompleted) {
            const fallbackFlags = await findInitialSyncStatusFlags(
              ctx,
              orgId,
              platform,
            );

            if (!fallbackFlags) {
              pendingPlatforms.add(platform);
              continue;
            }

            ({ hasActive, hasFailed, hasCompleted } = fallbackFlags);
          }

          // Precedence: completed > active > failed
          if (hasCompleted) {
            completedPlatforms.add(platform);
            continue;
          }

          if (hasActive) {
            pendingPlatforms.add(platform);
            continue;
          }

          if (hasFailed) {
            pendingPlatforms.add(platform);
            continue;
          }

          pendingPlatforms.add(platform);
        }

        const pendingPlatformsList = Array.from(pendingPlatforms);
        const pendingChanged = !(
          pendingPlatformsList.length === previousPending.size &&
          pendingPlatformsList.every((platform) => previousPending.has(platform))
        );

        const allCompleted =
          completedPlatforms.size === platforms.length &&
          pendingPlatforms.size === 0;

        if (pendingPlatforms.size > 0) {
          pendingCount += 1;
        } else if (allCompleted) {
          completedCount += 1;
        }

        if (pendingChanged || allCompleted !== wasComplete) {
          if (pendingPlatformsList.length > 0) {
            onboardingData.syncPendingPlatforms = pendingPlatformsList;
          } else {
            delete onboardingData.syncPendingPlatforms;
          }

          onboardingData.syncCheckAttempts = previousAttempts + 1;
          onboardingData.lastSyncCheckAt = now;

          await ctx.db.patch(onboarding._id, {
            isInitialSyncComplete: allCompleted,
            onboardingData,
            updatedAt: now,
          });

          appliedUpdate = true;
          justCompleted = !wasComplete && allCompleted;
        }

        // Best-effort snapshot refresh
        if (appliedUpdate) {
          try {
            await ctx.runMutation(internal.core.status.refreshIntegrationStatus, {
              organizationId: orgId,
            });
          } catch (_error) {
            // Best-effort refresh; ignore failures
          }
        }

        if (justCompleted) {
          const dates = buildDateSpan(
            ONBOARDING_COST_LOOKBACK_DAYS,
            new Date().toISOString(),
          );

          for (let index = 0; index < dates.length; index += ONBOARDING_ANALYTICS_REBUILD_CHUNK_SIZE) {
            const chunk = dates.slice(
              index,
              index + ONBOARDING_ANALYTICS_REBUILD_CHUNK_SIZE,
            );

            if (chunk.length === 0) {
              continue;
            }

            await createJob(
              ctx,
              "analytics:rebuildDaily",
              PRIORITY.LOW,
              {
                organizationId: orgId,
                dates: chunk,
              },
              {
                context: {
                  scope: "onboarding.analyticsRebuild",
                  chunkSize: chunk.length,
                  totalDates: dates.length,
                },
              },
            );
          }
        }
      } catch (error) {
        console.error(
          "[ONBOARDING] monitorInitialSyncs failed",
          {
            onboardingId: onboarding._id,
            error,
          },
        );
      }
    }

    return {
      checked: processed,
      completed: completedCount,
      analyticsTriggered: analyticsCount,
      pending: pendingCount,
    };
  },
});

/**
 * Save initial cost setup for historical data
 */
const ONBOARDING_COST_LOOKBACK_DAYS = 60;
const ONBOARDING_COST_LOOKBACK_MS = ONBOARDING_COST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
const ONBOARDING_ANALYTICS_REBUILD_CHUNK_SIZE = 5;

export const saveInitialCosts = mutation({
  args: {
    shippingCost: v.optional(v.number()),
    paymentFeePercent: v.optional(v.number()),
    operatingCosts: v.optional(v.number()),
    manualReturnRate: v.optional(v.number()),
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
    const retroactiveEffectiveFrom = now - ONBOARDING_COST_LOOKBACK_MS;
    let analyticsNeedsRefresh = false;

    // Create shipping cost record (flat per order)
    if (args.shippingCost !== undefined && args.shippingCost > 0) {
      const existingPerOrder = await ctx.db
        .query("globalCosts")
        .withIndex("by_org_type_frequency", (q) =>
          q
            .eq("organizationId", user.organizationId as Id<"organizations">)
            .eq("type", "shipping")
            .eq("frequency", "per_order"),
        )
        .first();

      if (existingPerOrder) {
        const shouldUpdate =
          existingPerOrder.calculation !== "fixed" ||
          existingPerOrder.frequency !== "per_order" ||
          existingPerOrder.value !== args.shippingCost ||
          !existingPerOrder.isActive ||
          !existingPerOrder.isDefault;

        if (shouldUpdate) {
          await ctx.db.patch(existingPerOrder._id, {
            calculation: "fixed",
            value: args.shippingCost,
            frequency: "per_order",
            isActive: true,
            isDefault: true,
            updatedAt: now,
            effectiveFrom:
              existingPerOrder.effectiveFrom &&
              existingPerOrder.effectiveFrom <= retroactiveEffectiveFrom
                ? existingPerOrder.effectiveFrom
                : retroactiveEffectiveFrom,
          } as any);
          analyticsNeedsRefresh = true;
        }
      } else {
        await ctx.db.insert("globalCosts", {
          organizationId: user.organizationId as Id<"organizations">,
          userId: user._id,
          type: "shipping",
          name: "Shipping Cost",
          description: "Initial shipping cost from onboarding",
          calculation: "fixed",
          value: args.shippingCost,
          frequency: "per_order",
        isActive: true,
        isDefault: true,
        effectiveFrom: retroactiveEffectiveFrom,
        createdAt: now,
        updatedAt: now,
      } as any);
      analyticsNeedsRefresh = true;
    }
    }

    // Create payment fee record if provided
    if (args.paymentFeePercent !== undefined && args.paymentFeePercent > 0) {
      const existingPayment = await ctx.db
        .query("globalCosts")
        .withIndex("by_org_and_type", (q) =>
          q.eq("organizationId", user.organizationId as Id<"organizations">).eq("type", "payment"),
        )
        .first();

      if (existingPayment) {
        const shouldUpdate =
          existingPayment.calculation !== "percentage" ||
          existingPayment.frequency !== "percentage" ||
          existingPayment.value !== args.paymentFeePercent ||
          !existingPayment.isActive ||
          !existingPayment.isDefault;

        if (shouldUpdate) {
          await ctx.db.patch(existingPayment._id, {
            calculation: "percentage",
            value: args.paymentFeePercent,
            frequency: "percentage",
            isActive: true,
            isDefault: true,
            updatedAt: now,
            effectiveFrom:
              existingPayment.effectiveFrom &&
              existingPayment.effectiveFrom <= retroactiveEffectiveFrom
                ? existingPayment.effectiveFrom
                : retroactiveEffectiveFrom,
          } as any);
          analyticsNeedsRefresh = true;
        }
      } else {
        await ctx.db.insert("globalCosts", {
          organizationId: user.organizationId as Id<"organizations">,
          userId: user._id,
          type: "payment",
          name: "Payment Processing Fee",
          description: "Initial payment fee percentage from onboarding",
          calculation: "percentage",
          value: args.paymentFeePercent,
          frequency: "percentage",
        isActive: true,
        isDefault: true,
        effectiveFrom: retroactiveEffectiveFrom,
        createdAt: now,
        updatedAt: now,
      } as any);
      analyticsNeedsRefresh = true;
    }
    }

    // Create operating costs record if provided
    if (args.operatingCosts !== undefined && args.operatingCosts > 0) {
      const existingOp = await ctx.db
        .query("globalCosts")
        .withIndex("by_org_type_frequency", (q) =>
          q
            .eq("organizationId", user.organizationId as Id<"organizations">)
            .eq("type", "operational")
            .eq("frequency", "monthly"),
        )
        .first();

      if (existingOp) {
        const shouldUpdate =
          existingOp.calculation !== "fixed" ||
          existingOp.frequency !== "monthly" ||
          existingOp.value !== args.operatingCosts ||
          !existingOp.isActive ||
          !existingOp.isDefault;

        if (shouldUpdate) {
          await ctx.db.patch(existingOp._id, {
            calculation: "fixed",
            value: args.operatingCosts,
            frequency: "monthly",
            isActive: true,
            isDefault: true,
            updatedAt: now,
            effectiveFrom:
              existingOp.effectiveFrom &&
              existingOp.effectiveFrom <= retroactiveEffectiveFrom
                ? existingOp.effectiveFrom
                : retroactiveEffectiveFrom,
          } as any);
          analyticsNeedsRefresh = true;
        }
      } else {
        await ctx.db.insert("globalCosts", {
          organizationId: user.organizationId,
          userId: user._id,
          type: "operational",
          name: "Operating Costs",
          description: "Initial monthly operating costs from onboarding",
          calculation: "fixed",
          value: args.operatingCosts,
          frequency: "monthly",
        isActive: true,
        isDefault: true,
        effectiveFrom: retroactiveEffectiveFrom,
        createdAt: now,
        updatedAt: now,
      } as any);
      analyticsNeedsRefresh = true;
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

    if (args.manualReturnRate !== undefined) {
      const manualRateResult = await ctx.runMutation(
        internal.core.costs.upsertManualReturnRate,
        {
          organizationId: user.organizationId as Id<"organizations">,
          userId: user._id,
          ratePercent: args.manualReturnRate,
          isActive: (args.manualReturnRate ?? 0) > 0,
          effectiveFrom: retroactiveEffectiveFrom,
        },
      );
      if (manualRateResult.changed) {
        analyticsNeedsRefresh = true;
      }
    }

    if (analyticsNeedsRefresh) {
      await ctx.scheduler.runAfter(0, internal.engine.analytics.calculateAnalytics, {
        organizationId: user.organizationId,
        dateRange: { daysBack: 90 },
        syncType: "incremental",
      });
    }

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
  handler: async (ctx, _args) => {
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
    const billingRecord = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .first();

    if (billingRecord) {
      const now = Date.now();
      const needsTrialInit =
        !billingRecord.trialStartDate ||
        billingRecord.hasTrialExpired;

      if (needsTrialInit) {
        const trialEndDate = now + 14 * 24 * 60 * 60 * 1000;

        await ctx.db.patch(billingRecord._id, {
          trialStartDate: now,
          trialEndDate,
          trialEndsAt: trialEndDate,
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

    const seedUrl = FIRECRAWL_SEED_URL
      ? FIRECRAWL_SEED_URL
      : IS_PRODUCTION_ENVIRONMENT
        ? domain.startsWith("http")
          ? domain
          : `https://${domain}`
        : DEV_FIRECRAWL_TEST_URL;

    const firecrawlStatus = onboarding.onboardingData?.firecrawlSeedingStatus;
    const hasSeededFirecrawl = Boolean(
      onboarding.onboardingData?.firecrawlSeededAt,
    );
    const firecrawlBusy =
      firecrawlStatus?.status === "scheduled" ||
      firecrawlStatus?.status === "in_progress";

    if (!hasSeededFirecrawl && !firecrawlBusy && seedUrl) {
      try {
        await ctx.db.patch(onboarding._id, {
          onboardingData: {
            ...onboarding.onboardingData,
            firecrawlSeedingStatus: {
              status: "scheduled",
              startedAt: Date.now(),
            },
          },
          updatedAt: Date.now(),
        });

        await ctx.scheduler.runAfter(
          0,
          api.agent.firecrawlSeed.seedDocsFromFirecrawl,
          {
            url: seedUrl,
            organizationId: user.organizationId as Id<"organizations">,
            shopDomain: domain,
          },
        );
        await ctx.scheduler.runAfter(
          0,
          api.agent.brandSummary.upsertBrandSummary,
          {
            organizationId: user.organizationId as Id<"organizations">,
          },
        );
      } catch (error) {
        console.error(
          "[ONBOARDING] Firecrawl documentation seeding failed",
          error,
        );
      }
    }

    return {
      success: true,
      organizationId: user.organizationId as Id<"organizations">,
    };
  },
});

// (Removed unused internal mutations: resetOnboarding, needsOnboarding)
