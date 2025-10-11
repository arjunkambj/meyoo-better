import { v } from "convex/values";

import { ONBOARDING_STEP_KEYS, ONBOARDING_STEPS } from "@repo/types";

const onboardingStepNumberValidator = v.union(
  v.literal(ONBOARDING_STEPS.SHOPIFY),
  v.literal(ONBOARDING_STEPS.BILLING),
  v.literal(ONBOARDING_STEPS.MARKETING),
  v.literal(ONBOARDING_STEPS.ACCOUNTS),
  v.literal(ONBOARDING_STEPS.PRODUCTS),
  v.literal(ONBOARDING_STEPS.COSTS),
  v.literal(ONBOARDING_STEPS.COMPLETE),
);

const onboardingStepKeyValidator = v.union(
  v.literal(ONBOARDING_STEP_KEYS[ONBOARDING_STEPS.SHOPIFY]),
  v.literal(ONBOARDING_STEP_KEYS[ONBOARDING_STEPS.BILLING]),
  v.literal(ONBOARDING_STEP_KEYS[ONBOARDING_STEPS.MARKETING]),
  v.literal(ONBOARDING_STEP_KEYS[ONBOARDING_STEPS.ACCOUNTS]),
  v.literal(ONBOARDING_STEP_KEYS[ONBOARDING_STEPS.PRODUCTS]),
  v.literal(ONBOARDING_STEP_KEYS[ONBOARDING_STEPS.COSTS]),
  v.literal(ONBOARDING_STEP_KEYS[ONBOARDING_STEPS.COMPLETE]),
);

const syncStageFlagsValidator = v.object({
  products: v.boolean(),
  inventory: v.boolean(),
  customers: v.boolean(),
  orders: v.boolean(),
});

const platformSyncStatusValidator = v.object({
  status: v.string(),
  overallState: v.optional(
    v.union(
      v.literal("unsynced"),
      v.literal("syncing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
  ),
  stages: v.optional(syncStageFlagsValidator),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
  recordsProcessed: v.optional(v.number()),
});

export const onboardingStatusValidator = v.union(
  v.null(),
  v.object({
    completed: v.boolean(),
    currentStep: onboardingStepNumberValidator,
    completedSteps: v.array(onboardingStepKeyValidator),
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
    syncStatus: v.optional(
      v.object({
        shopify: v.optional(platformSyncStatusValidator),
        meta: v.optional(platformSyncStatusValidator),
      }),
    ),
  }),
);

export {
  onboardingStepKeyValidator,
  onboardingStepNumberValidator,
  platformSyncStatusValidator,
  syncStageFlagsValidator,
};
