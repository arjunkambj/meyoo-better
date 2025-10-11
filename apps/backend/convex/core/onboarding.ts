import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { ensureActiveMembership } from "../authHelpers";
import { createJob, PRIORITY } from "../engine/workpool";
import { normalizeShopDomain } from "../utils/shop";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";
import { buildDateSpan } from "../utils/date";
import { optionalEnv } from "../utils/env";
import { onboardingStatusValidator } from "../utils/onboardingValidators";
import { isIanaTimeZone } from "@repo/time";
import {
  ONBOARDING_STEP_KEYS,
  ONBOARDING_STEPS,
  type OnboardingStepKey,
  type OnboardingStepNumber,
} from "@repo/types";

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

const ONBOARDING_STEP_NUMBER_VALUES = Object.values(ONBOARDING_STEPS) as OnboardingStepNumber[];
const ONBOARDING_STEP_KEY_VALUES = Object.values(ONBOARDING_STEP_KEYS) as OnboardingStepKey[];

const isOnboardingStepNumber = (value: number): value is OnboardingStepNumber =>
  ONBOARDING_STEP_NUMBER_VALUES.includes(value as OnboardingStepNumber);

const isOnboardingStepKey = (value: unknown): value is OnboardingStepKey =>
  typeof value === "string" && ONBOARDING_STEP_KEY_VALUES.includes(value as OnboardingStepKey);

const isInitialSyncSession = (session: Doc<"syncSessions">): boolean =>
  session.type === "initial" || session.metadata?.isInitialSync === true;

type SyncStageFlags = {
  products: boolean;
  inventory: boolean;
  customers: boolean;
  orders: boolean;
};

const emptyStageFlags: SyncStageFlags = {
  products: false,
  inventory: false,
  customers: false,
  orders: false,
};

const extractStageFlags = (
  metadata: Record<string, unknown> | undefined,
): SyncStageFlags => {
  if (!metadata) {
    return emptyStageFlags;
  }

  const stageStatus = (metadata.stageStatus || {}) as Record<string, string>;
  const syncedEntities = Array.isArray(metadata.syncedEntities)
    ? new Set(metadata.syncedEntities as string[])
    : undefined;
  const isComplete = (key: keyof SyncStageFlags): boolean => {
    const value = stageStatus?.[key];
    if (typeof value === "string" && value.toLowerCase() === "completed") {
      return true;
    }
    return syncedEntities?.has(key) ?? false;
  };

  return {
    products: isComplete("products"),
    inventory: isComplete("inventory"),
    customers: isComplete("customers"),
    orders: isComplete("orders"),
  };
};

type OverallState = "unsynced" | "syncing" | "complete" | "failed";

const deriveOverallState = (sessions: Doc<"syncSessions">[]): OverallState => {
  if (!sessions.length) {
    return "unsynced";
  }

  const relevant = sessions.filter((session) => isInitialSyncSession(session));
  const targetSessions = relevant.length > 0 ? relevant : sessions;

  if (targetSessions.some((session) => session.status === "completed")) {
    return "complete";
  }

  if (
    targetSessions.some((session) =>
      ACTIVE_SYNC_STATUSES.has(session.status as SyncSessionStatus),
    )
  ) {
    return "syncing";
  }

  if (targetSessions.some((session) => session.status === "failed")) {
    return "failed";
  }

  return "unsynced";
};

// ============ QUERIES ============

/**
 * Get current onboarding status
 */
export const getOnboardingStatus = query({
  args: {},
  returns: onboardingStatusValidator,
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

    // Prefer a small recent window for sync insight to keep the payload light
    const shopifySessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", orgId)
          .eq("platform", "shopify"),
      )
      .order("desc")
      .take(5);
    const metaSessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", orgId)
          .eq("platform", "meta"),
      )
      .order("desc")
      .take(5);

    const latestShopifySession = shopifySessions[0];
    const latestMetaSession = metaSessions[0];

    let initialShopifySession = shopifySessions.find((session) =>
      isInitialSyncSession(session),
    );

    if (!initialShopifySession) {
      // Pull the oldest session so stage flags keep the first full import metadata.
      const oldestShopifySession = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_date", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("platform", "shopify"),
        )
        .order("asc")
        .first();

      if (oldestShopifySession && isInitialSyncSession(oldestShopifySession)) {
        initialShopifySession = oldestShopifySession;
      }
    }

    const shopifySessionsForStatus = initialShopifySession
      ? shopifySessions.some(
          (session) => session._id === initialShopifySession._id,
        )
        ? shopifySessions
        : [...shopifySessions, initialShopifySession]
      : shopifySessions;

    const shopifyMetadata = (
      initialShopifySession?.metadata ??
      latestShopifySession?.metadata ??
      {}
    ) as Record<string, unknown> | undefined;
    const shopifyStages = extractStageFlags(shopifyMetadata);

    const shopifyOverall = deriveOverallState(shopifySessionsForStatus);
    const metaOverall = deriveOverallState(metaSessions);

    const rawCurrentStep = onboarding.onboardingStep ?? ONBOARDING_STEPS.SHOPIFY;
    const currentStep: OnboardingStepNumber = isOnboardingStepNumber(rawCurrentStep)
      ? rawCurrentStep
      : ONBOARDING_STEPS.SHOPIFY;

    const completedStepsRaw = onboarding.onboardingData?.completedSteps ?? [];
    const completedSteps: OnboardingStepKey[] = completedStepsRaw.filter(isOnboardingStepKey);

    return {
      completed: onboarding.isCompleted || false,
      currentStep,
      completedSteps,
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
              overallState: shopifyOverall,
              stages: shopifyStages,
              startedAt: latestShopifySession.startedAt,
              completedAt: latestShopifySession.completedAt,
              lastError: latestShopifySession.error,
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

    const demoOrgCurrency = await ctx.runQuery(
      api.core.currency.getPrimaryCurrencyForOrg,
      { orgId: demoOrgId },
    );
    const resolvedCurrency =
      demoOrgCurrency ?? demoOrg.primaryCurrency ?? "USD";

    const now = Date.now();

    if (resolvedCurrency !== demoOrg.primaryCurrency) {
      await ctx.db.patch(demoOrgId, {
        primaryCurrency: resolvedCurrency,
        updatedAt: now,
      });
    }

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

    // Start per-org monitoring if syncs are pending
    if (pendingPlatformsList.length > 0) {
      console.log(
        `[ONBOARDING] Starting per-org monitoring for ${user.organizationId} - ${pendingPlatformsList.length} platform(s) syncing`,
      );
      await ctx.scheduler.runAfter(
        10000, // Check in 10 seconds
        internal.core.onboarding.monitorInitialSyncs,
        { organizationId: user.organizationId as Id<"organizations"> },
      );
    } else {
      console.log(`[ONBOARDING] All syncs already complete for ${user.organizationId}, no monitoring needed`);
    }

    // Always kick off a monitoring pass immediately so analytics can trigger
    try {
      await ctx.runMutation(
        internal.core.onboarding.triggerMonitorIfOnboardingComplete,
        {
          organizationId: user.organizationId as Id<"organizations">,
          limit: 1,
          reason: "onboarding_complete",
        },
      );
    } catch (monitorError) {
      console.warn(
        `[ONBOARDING] monitorInitialSyncs immediate run failed for ${user.organizationId}`,
        monitorError,
      );
    }

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

/**
 * Trigger monitoring only when onboarding has been completed.
 * Prevents monitorInitialSyncs from running for organizations
 * that haven't reached the completion step yet.
 */
export const triggerMonitorIfOnboardingComplete = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    triggered: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!onboarding) {
      return {
        triggered: false,
        reason: "onboarding_not_found",
      };
    }

    if (!onboarding.isCompleted) {
      return {
        triggered: false,
        reason: "onboarding_incomplete",
      };
    }

    await ctx.runMutation(internal.core.onboarding.monitorInitialSyncs, {
      organizationId: args.organizationId,
      limit: args.limit ?? 1,
    });

    return {
      triggered: true,
      reason: args.reason,
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
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const limitArg = args.limit ?? 25;
    const limit = Math.min(Math.max(limitArg, 1), 100);

    // Only query orgs that need monitoring (analytics not yet calculated)
    const candidates = await (async () => {
      if (args.organizationId) {
        const records = await ctx.db
          .query("onboarding")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId as Id<"organizations">),
          )
          .take(limit);

        console.log(`[MONITOR_CRON] Specific org query returned ${records.length} records`);
        return records;
      }

      // Query only orgs that haven't completed analytics calculation
      const allRecords = await ctx.db
        .query("onboarding")
        .withIndex("by_completed", (q) => q.eq("isCompleted", true))
        .take(limit * 3);

      const needsMonitoring = allRecords.filter((record) => {
        const status = record.analyticsCalculationStatus;
        return !status || status === "not_started" || status === "pending" || status === "failed";
      });

      console.log(`[MONITOR_CRON] Found ${allRecords.length} completed onboardings, ${needsMonitoring.length} need monitoring`);
      return needsMonitoring.slice(0, limit);
    })();

    console.log(`[MONITOR_CRON] Starting monitoring check for ${candidates.length} orgs`);

    let processed = 0;
    let completedCount = 0;
    let analyticsCount = 0;
    let pendingCount = 0;
    let skippedCount = 0;

    const now = Date.now();

    // Helper: Get latest sync session for a platform
    const getLatestSyncSession = async (
      orgId: Id<"organizations">,
      platform: "shopify" | "meta",
    ): Promise<Doc<"syncSessions"> | null> => {
      const sessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_date", (q) =>
          q.eq("organizationId", orgId).eq("platform", platform),
        )
        .order("desc")
        .take(5);

      // Find the latest initial sync session
      const initialSessions = sessions.filter(isInitialSyncSession);
      return initialSessions[0] || sessions[0] || null;
    };

    // Heal sync sessions that imported data but never flipped to "completed" so onboarding can finish.
    const attemptFinalizeSession = async (
      session: Doc<"syncSessions">,
    ): Promise<
      | {
          finalized: true;
          normalizedOrdersProcessed?: number;
        }
      | { finalized: false; shouldFail?: boolean; reason?: string }
    > => {
      if (session.status === "completed") {
        return { finalized: true };
      }

      const metadata = (session.metadata || {}) as Record<string, any>;
      const metadataLastActivity =
        typeof metadata.lastActivityAt === "number"
          ? metadata.lastActivityAt
          : typeof metadata.progressUpdatedAt === "number"
            ? metadata.progressUpdatedAt
            : undefined;
      const lastProgressAt =
        metadataLastActivity ?? session.completedAt ?? session.startedAt;

      const timeSinceLastActivity = Date.now() - lastProgressAt;
      const isActivelySyncing =
        (session.status === "processing" || session.status === "syncing") &&
        timeSinceLastActivity < 2 * 60 * 1000;

      if (isActivelySyncing) {
        console.log(`[MONITOR_CRON] Session still active - last activity ${Math.floor(timeSinceLastActivity / 1000)}s ago`);
        return { finalized: false };
      }

      const inactiveMinutes = Math.floor(timeSinceLastActivity / (60 * 1000));
      console.log(`[MONITOR_CRON] Session inactive for ${Math.floor(timeSinceLastActivity / 1000)}s (${inactiveMinutes} minutes), checking completion criteria...`);

      // Detect stuck sessions: inactive >30min with minimal progress
      const STUCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      if (timeSinceLastActivity > STUCK_TIMEOUT_MS) {
        const completedBatches = typeof metadata.completedBatches === "number" ? metadata.completedBatches : 0;
        const totalBatches = typeof metadata.totalBatches === "number" ? metadata.totalBatches : 0;
        const progressPercent = totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;

        if (progressPercent < 50) {
          console.log(`[MONITOR_CRON] 🚨 STUCK SESSION DETECTED - Inactive ${inactiveMinutes}min with only ${progressPercent}% progress (${completedBatches}/${totalBatches} batches)`);
          return {
            finalized: false,
            shouldFail: true,
            reason: `Stuck for ${inactiveMinutes} minutes with ${progressPercent}% progress`,
          };
        }

        console.log(`[MONITOR_CRON] Session inactive ${inactiveMinutes}min but has ${progressPercent}% progress - allowing more time`);
      }

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

      console.log(`[MONITOR_CRON] Completion checks: batches=${isBatchesComplete} (${completedBatches}/${totalBatches}), orders=${isOrdersComplete} (${normalizedOrdersProcessed}/${ordersQueued}), stages=${isStagesComplete}`);

      if (!isBatchesComplete && !isOrdersComplete && !isStagesComplete) {
        console.log(`[MONITOR_CRON] Session not ready to finalize - no completion criteria met`);
        return { finalized: false };
      }

      console.log(`[MONITOR_CRON] Session meets completion criteria - finalizing...`);

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

      const orgId = onboarding.organizationId as Id<"organizations">;
      const checkCount = (onboarding.monitorCheckCount ?? 0) + 1;

      console.log(`[MONITOR_CRON] Checking org ${orgId} (check #${checkCount})`);

      processed += 1;

      try {
        if (!onboarding.isCompleted) {
          console.log(
            `[MONITOR_CRON] Org ${orgId}: Onboarding not completed yet, skipping analytics trigger`,
          );

          const skipUpdate: Record<string, any> = {
            lastMonitorCheckAt: now,
            monitorCheckCount: checkCount,
          };

          if (!onboarding.analyticsCalculationStatus) {
            skipUpdate.analyticsCalculationStatus = "not_started";
          }

          await ctx.db.patch(onboarding._id, skipUpdate as any);
          skippedCount += 1;
          continue;
        }

        // Skip if analytics already calculated
        if (onboarding.analyticsCalculationStatus === "completed") {
          console.log(`[MONITOR_CRON] Org ${orgId}: SKIPPED - Analytics already completed`);
          skippedCount += 1;
          continue;
        }

        // Skip if currently calculating (another process might be handling it)
        if (onboarding.analyticsCalculationStatus === "calculating") {
          console.log(`[MONITOR_CRON] Org ${orgId}: SKIPPED - Analytics calculation in progress`);
          skippedCount += 1;
          continue;
        }

        // Check Shopify connection and sync status
        if (!onboarding.hasShopifyConnection) {
          console.log(`[MONITOR_CRON] Org ${orgId}: Waiting for Shopify connection`);
          await ctx.db.patch(onboarding._id, {
            lastMonitorCheckAt: now,
            monitorCheckCount: checkCount,
            analyticsCalculationStatus: "not_started",
          });
          skippedCount += 1;
          continue;
        }

        const shopifySession = await getLatestSyncSession(orgId, "shopify");
        const shopifyStatus = shopifySession?.status || "none";
        console.log(`[MONITOR_CRON] Org ${orgId}: Shopify sync status = ${shopifyStatus}`);

        // Try to finalize Shopify session if needed
        let shopifyCompleted = shopifyStatus === "completed";
        let sessionStuckOrFailed = false;

        if (!shopifyCompleted && shopifySession) {
          console.log(`[MONITOR_CRON] Org ${orgId}: Attempting to finalize Shopify session...`);
          const finalizeResult = await attemptFinalizeSession(shopifySession);

          if (finalizeResult.finalized) {
            shopifyCompleted = true;
            console.log(`[MONITOR_CRON] Org ${orgId}: ✅ Shopify session finalized successfully`);
          } else if (finalizeResult.shouldFail) {
            // Session is stuck - mark as failed and trigger analytics anyway
            console.log(`[MONITOR_CRON] Org ${orgId}: 🚨 Session stuck/failed: ${finalizeResult.reason}`);
            console.log(`[MONITOR_CRON] Org ${orgId}: Marking session as failed and triggering analytics with partial data`);

            // Mark session as failed
            await ctx.db.patch(shopifySession._id, {
              status: "failed",
              completedAt: now,
              metadata: {
                ...(shopifySession.metadata || {}),
                failureReason: finalizeResult.reason,
                partialSync: true,
              } as any,
            });

            sessionStuckOrFailed = true;
            shopifyCompleted = true; // Treat as "completed" for analytics trigger
          } else {
            console.log(`[MONITOR_CRON] Org ${orgId}: Session not ready to finalize - still processing`);
          }
        }

        // Check if Shopify is still syncing (after finalization attempt)
        if (!shopifyCompleted && !sessionStuckOrFailed && ACTIVE_SYNC_STATUSES.has(shopifyStatus as any)) {
          console.log(`[MONITOR_CRON] Org ${orgId}: Shopify sync in progress...`);
          await ctx.db.patch(onboarding._id, {
            lastMonitorCheckAt: now,
            monitorCheckCount: checkCount,
            analyticsCalculationStatus: "pending",
          });
          pendingCount += 1;
          continue;
        }

        // Check if Shopify failed
        if (shopifyStatus === "failed" && !shopifyCompleted) {
          console.log(`[MONITOR_CRON] Org ${orgId}: ERROR - Shopify sync failed`);
          await ctx.db.patch(onboarding._id, {
            lastMonitorCheckAt: now,
            monitorCheckCount: checkCount,
            analyticsCalculationStatus: "failed",
          });
          continue;
        }

        // Shopify must be completed at this point
        if (!shopifyCompleted) {
          console.log(`[MONITOR_CRON] Org ${orgId}: Shopify sync not yet complete`);
          await ctx.db.patch(onboarding._id, {
            lastMonitorCheckAt: now,
            monitorCheckCount: checkCount,
          });
          pendingCount += 1;
          continue;
        }

        // Check Meta if connected
        let metaCompleted = true; // Default to true if not connected
        if (onboarding.hasMetaConnection) {
          // Verify Meta session exists
          const metaIntegrationSession = await ctx.db
            .query("integrationSessions")
            .withIndex("by_org_platform_and_status", (q) =>
              q
                .eq("organizationId", orgId)
                .eq("platform", "meta")
                .eq("isActive", true),
            )
            .first();

          if (metaIntegrationSession) {
            const metaSession = await getLatestSyncSession(orgId, "meta");
            const metaStatus = metaSession?.status || "none";
            console.log(`[MONITOR_CRON] Org ${orgId}: Meta sync status = ${metaStatus}`);

            metaCompleted = metaStatus === "completed";

            if (ACTIVE_SYNC_STATUSES.has(metaStatus as any)) {
              console.log(`[MONITOR_CRON] Org ${orgId}: Meta sync in progress...`);
              await ctx.db.patch(onboarding._id, {
                lastMonitorCheckAt: now,
                monitorCheckCount: checkCount,
                analyticsCalculationStatus: "pending",
              });
              pendingCount += 1;
              continue;
            }

            if (metaStatus === "failed") {
              console.log(`[MONITOR_CRON] Org ${orgId}: WARNING - Meta sync failed, continuing with Shopify data only`);
              metaCompleted = true; // Continue anyway
            }
          } else {
            console.log(`[MONITOR_CRON] Org ${orgId}: Meta connected but no active session found`);
          }
        }

        // All syncs complete - trigger analytics calculation
        if (shopifyCompleted && metaCompleted) {
          console.log(`[MONITOR_CRON] Org ${orgId}: ✅ ALL SYNCS COMPLETE - Triggering analytics calculation`);

          // Mark as calculating
          await ctx.db.patch(onboarding._id, {
            analyticsCalculationStatus: "calculating",
            lastMonitorCheckAt: now,
            monitorCheckCount: checkCount,
            isInitialSyncComplete: true,
            onboardingData: {
              ...onboarding.onboardingData,
              analyticsTriggeredAt: now,
            },
          });

          // Create analytics rebuild jobs
          const dates = buildDateSpan(
            ONBOARDING_COST_LOOKBACK_DAYS,
            new Date().toISOString(),
          );

          const totalJobs = Math.ceil(dates.length / ONBOARDING_ANALYTICS_REBUILD_CHUNK_SIZE);
          console.log(`[MONITOR_CRON] Org ${orgId}: Creating ${totalJobs} analytics jobs for ${dates.length} days`);

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
              PRIORITY.HIGH, // HIGH priority for onboarding
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
            analyticsCount += 1;
          }

          // Mark as completed immediately
          // Jobs will populate dailyMetrics, then dashboard can read from it
          await ctx.db.patch(onboarding._id, {
            analyticsCalculationStatus: "completed",
          });

          console.log(`[MONITOR_CRON] Org ${orgId}: ✅ Analytics calculation initiated successfully`);
          console.log(`[MONITOR_CRON] Org ${orgId}: Will no longer be monitored`);

          completedCount += 1;

          // Best-effort snapshot refresh
          try {
            await ctx.runMutation(internal.core.status.refreshIntegrationStatus, {
              organizationId: orgId,
            });
          } catch (_error) {
            // Best-effort refresh; ignore failures
          }
        }
      } catch (error) {
        console.error(
          `[MONITOR_CRON] Org ${orgId}: ERROR during monitoring`,
          {
            onboardingId: onboarding._id,
            error,
          },
        );

        // Mark as failed so we can investigate
        try {
          await ctx.db.patch(onboarding._id, {
            analyticsCalculationStatus: "failed",
            lastMonitorCheckAt: now,
            monitorCheckCount: checkCount,
          });
        } catch (_patchError) {
          // Ignore patch errors
        }
      }
    }

    console.log(`[MONITOR_CRON] Monitoring complete - checked: ${processed}, completed: ${completedCount}, pending: ${pendingCount}, skipped: ${skippedCount}, analytics jobs: ${analyticsCount}`);

    // Self-scheduling: If monitoring a specific org and still pending, reschedule
    if (args.organizationId && pendingCount > 0) {
      console.log(`[MONITOR_CRON] Org ${args.organizationId}: Still pending, rescheduling check in 10 seconds`);
      await ctx.scheduler.runAfter(
        10000, // 10 seconds
        internal.core.onboarding.monitorInitialSyncs,
        { organizationId: args.organizationId },
      );
    } else if (args.organizationId) {
      console.log(`[MONITOR_CRON] Org ${args.organizationId}: Monitoring complete, will not reschedule`);
    }

    return {
      checked: processed,
      completed: completedCount,
      analyticsTriggered: analyticsCount,
      pending: pendingCount,
      skipped: skippedCount,
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

    if (user.organizationId) {
      const orgId = user.organizationId as Id<"organizations">;
      const orgDoc = await ctx.db.get(orgId);
      if (!orgDoc || orgDoc.primaryCurrency !== currency) {
        await ctx.db.patch(orgId, {
          primaryCurrency: currency,
          updatedAt: Date.now(),
        });
      }
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
    const hasAttemptedFirecrawl = Boolean(
      onboarding.onboardingData?.firecrawlLastAttemptAt,
    );
    const hasSeededFirecrawl = Boolean(
      onboarding.onboardingData?.firecrawlSeededAt,
    );
    const firecrawlBusy =
      firecrawlStatus?.status === "scheduled" ||
      firecrawlStatus?.status === "in_progress";

    if (!hasSeededFirecrawl && !firecrawlBusy && !hasAttemptedFirecrawl && seedUrl) {
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

/**
 * Get onboarding record by organization ID
 * Used by admin tools to mark analytics as completed
 */
export const getOnboardingByOrganization = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("onboarding"),
      analyticsCalculationStatus: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("onboarding")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!record) return null;

    return {
      _id: record._id,
      analyticsCalculationStatus: record.analyticsCalculationStatus,
    };
  },
});

/**
 * Mark analytics calculation as completed
 * Called when admin manually triggers analytics via dev tools
 * This stops the cron from continuing to check this org
 */
export const markAnalyticsCompleted = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
    triggeredBy: v.string(),
    jobCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.onboardingId);

    if (!existing) {
      console.warn(`[ONBOARDING] Cannot mark analytics completed - onboarding ${args.onboardingId} not found`);
      return;
    }

    await ctx.db.patch(args.onboardingId, {
      analyticsCalculationStatus: "completed",
      lastMonitorCheckAt: Date.now(),
      onboardingData: {
        ...(existing.onboardingData || {}),
        analyticsTriggeredAt: Date.now(),
        manuallyTriggered: true,
        triggeredBy: args.triggeredBy,
        manualJobCount: args.jobCount,
      } as any,
    });

    console.log(
      `[ONBOARDING] Analytics marked as completed for ${args.onboardingId} by ${args.triggeredBy}${args.jobCount ? ` (${args.jobCount} jobs)` : ""} - cron will stop monitoring`,
    );
  },
});

// (Removed unused internal mutations: resetOnboarding, needsOnboarding)
