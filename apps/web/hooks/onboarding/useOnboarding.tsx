import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/libs/convexApi";
import type { OnboardingStatus } from "@repo/types";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

/**
 * Onboarding Flow Management Hooks
 */

// Use key-based helpers derived from ONBOARDING_STEPS; no separate numeric mapping.

function useOnboardingInternal() {
  const rawStatus = useQuery(api.core.onboarding.getOnboardingStatus);
  const status = rawStatus as OnboardingStatus | null | undefined;
  const integrationStatus = useQuery(api.core.status.getIntegrationStatus);
  type Overall = 'unsynced' | 'syncing' | 'complete' | 'failed';
  const syncStatus = status?.syncStatus;
  const updateStateMutation = useMutation(
    api.core.onboarding.updateOnboardingState
  );
  const updateProfileMutation = useMutation(
    api.core.onboarding.updateBusinessProfile
  );
  const completeMutation = useMutation(api.core.onboarding.completeOnboarding);

  const shopifyOverall = syncStatus?.shopify?.overallState as Overall | undefined;
  const shopifySyncStatus = syncStatus?.shopify?.status ?? null;
  const shopifyExpectedOrders =
    integrationStatus?.shopify?.expectedOrders ??
    null;
  const shopifyOrdersInDb = integrationStatus?.shopify?.ordersInDb ?? null;
  const isInitialSyncComplete = status?.isInitialSyncComplete || false;
  const isShopifySynced =
    integrationStatus?.shopify?.initialSynced === true ||
    shopifyOverall === 'complete' ||
    isInitialSyncComplete ||
    shopifySyncStatus === "completed";
  const isShopifySyncing = integrationStatus?.shopify?.initialSynced
    ? false
    : shopifyOverall
      ? shopifyOverall === 'syncing'
      : shopifySyncStatus
        ? ["pending", "syncing", "processing"].includes(shopifySyncStatus)
        : false;
  const hasShopifySyncError = shopifyOverall
    ? shopifyOverall === 'failed'
    : shopifySyncStatus === "failed";
  const shopifyStages = syncStatus?.shopify?.stages ?? null;
  const shopifySyncProgress = {
    status: shopifySyncStatus,
    startedAt: syncStatus?.shopify?.startedAt ?? null,
    completedAt: syncStatus?.shopify?.completedAt ?? null,
    lastError: syncStatus?.shopify?.lastError ?? null,
    stages: shopifyStages,
  } as const;
  const isShopifyProductsSynced =
    Boolean(shopifyStages?.products);
  const isShopifyInventorySynced =
    Boolean(shopifyStages?.inventory);
  const isShopifyCustomersSynced =
    Boolean(shopifyStages?.customers);
  const isShopifyOrdersSynced =
    Boolean(shopifyStages?.orders);

  // Next step navigation
  const nextStep = async () => {
    if (!status) return { success: false, error: "Status not loaded" };
    const next = (status.currentStep || 1) + 1;

    try {
      await updateStateMutation({ step: next });

      return { success: true, nextStep: next };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  // Update business profile
  const updateBusinessProfile = async (data: {
    organizationName?: string;
    mobileNumber?: string;
    mobileCountryCode?: string;
    referralSource?: string;
  }) => {
    try {
      const result = await updateProfileMutation(data);

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  // Finish onboarding
  const finishOnboarding = async () => {
    try {
      const result = await completeMutation({});

      return {
        success: true,
        analyticsScheduled: result.analyticsScheduled,
        platformsSyncing: result.platformsSyncing,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  return {
    status,
    loading: rawStatus === undefined,
    error:
      status === null && rawStatus !== undefined
        ? "Failed to load onboarding status"
        : null,
    isCompleted: status?.completed || false,
    currentStep: status?.currentStep || 1,
    completedSteps: status?.completedSteps || [],
    connections: status?.connections || {
      shopify: false,
      meta: false,
    },
    syncStatus,
    integrationStatus,
    // New functions
    nextStep,
    updateBusinessProfile,
    finishOnboarding,
    // Connection status helpers
    hasShopify: status?.connections?.shopify || false,
    isProductCostSetup: status?.isProductCostSetup || false,
    isExtraCostSetup: status?.isExtraCostSetup || false,
    isInitialSyncComplete: status?.isInitialSyncComplete || false,
    pendingSyncPlatforms: status?.pendingSyncPlatforms || [],
    analyticsTriggeredAt: status?.analyticsTriggeredAt,
    lastSyncCheckAt: status?.lastSyncCheckAt,
    syncCheckAttempts: status?.syncCheckAttempts ?? 0,
    hasMeta: status?.connections?.meta || false,
    // Enum-like sync state for Shopify
    shopifySyncState: shopifyOverall,
    shopifySyncStatus,
    isShopifySynced,
    isShopifySyncing,
    hasShopifySyncError,
    shopifySyncProgress,
    shopifyStages,
    isShopifyProductsSynced,
    isShopifyInventorySynced,
    isShopifyCustomersSynced,
    isShopifyOrdersSynced,
    shopifyExpectedOrders,
    shopifyOrdersInDb,
  };
}

type OnboardingContextValue = ReturnType<typeof useOnboardingInternal>;

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const value = useOnboardingInternal();

  const memoValue = useMemo(
    () => ({ ...value }),
    [
      value.status,
      value.loading,
      value.error,
      value.isCompleted,
      value.currentStep,
      value.completedSteps,
      value.connections,
      value.syncStatus,
      value.nextStep,
      value.updateBusinessProfile,
      value.finishOnboarding,
      value.hasShopify,
      value.isProductCostSetup,
      value.isExtraCostSetup,
      value.hasMeta,
      value.shopifySyncState,
      value.shopifySyncStatus,
      value.isShopifySynced,
      value.isShopifySyncing,
      value.hasShopifySyncError,
      value.shopifySyncProgress,
      value.shopifyStages,
      value.isShopifyProductsSynced,
      value.isShopifyInventorySynced,
      value.isShopifyCustomersSynced,
      value.isShopifyOrdersSynced,
      value.integrationStatus,
      value.shopifyExpectedOrders,
      value.shopifyOrdersInDb,
    ],
  );

  return (
    <OnboardingContext.Provider value={memoValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

/**
 * Get current onboarding status
 */
export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);

  if (context) {
    return context;
  }

  return useOnboardingInternal();
}

/**
 * Get current onboarding step
 */
// Removed unused: useOnboardingStep

/**
 * Update business profile during onboarding
 */
// Removed unused: useUpdateBusinessProfile

/**
 * Update onboarding state
 */
export function useUpdateOnboardingState() {
  const mutation = useMutation(api.core.onboarding.updateOnboardingState);

  return async (data: {
    step?: number;
    connections?: {
      shopify?: boolean;
      meta?: boolean;
    };
    completedSteps?: string[];
    isComplete?: boolean;
  }) => {
    try {
      const result = await mutation(data);

      return {
        success: true,
        shouldTriggerAnalytics: result.shouldTriggerAnalytics,
      };
    } catch (error) {
      // Failed to update onboarding state

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update onboarding state",
      };
    }
  };
}

/**
 * Complete onboarding and trigger initial sync
 */
// Removed unused: useCompleteOnboarding

/**
 * Skip onboarding step
 */
// Removed unused: useSkipStep

/**
 * Check if a specific step is completed
 */
/**
 * Get progress percentage
 */
// Removed unused: useOnboardingProgress

/**
 * Navigate to next onboarding step
 */
// Removed unused: useNextOnboardingStep

/**
 * Navigate to previous onboarding step
 */
// Removed unused: usePreviousOnboardingStep

/**
 * Check if user can proceed to next step
 */
// Removed unused: useCanProceedToNextStep
