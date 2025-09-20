import { useMutation } from "convex/react";
import { getStepKeyById, TOTAL_STEPS } from "@/constants/onboarding";
import { api } from "@/libs/convexApi";
import { useQuery } from "convex-helpers/react/cache/hooks";

/**
 * Onboarding Flow Management Hooks
 */

// Use key-based helpers derived from ONBOARDING_STEPS; no separate numeric mapping.

/**
 * Get current onboarding status
 */
export function useOnboarding() {
  const status = useQuery(api.core.onboarding.getOnboardingStatus);
  const updateStateMutation = useMutation(
    api.core.onboarding.updateOnboardingState
  );
  const updateProfileMutation = useMutation(
    api.core.onboarding.updateBusinessProfile
  );
  const completeMutation = useMutation(api.core.onboarding.completeOnboarding);

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
    businessType?: string;
    businessCategory?: string;
    industry?: string;
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
    loading: status === undefined,
    error:
      status === null && status !== undefined
        ? "Failed to load onboarding status"
        : null,
    isCompleted: status?.completed || false,
    currentStep: status?.currentStep || 1,
    completedSteps: status?.completedSteps || [],
    connections: status?.connections || {
      shopify: false,
      meta: false,
    },
    // New functions
    nextStep,
    updateBusinessProfile,
    finishOnboarding,
    // Connection status helpers
    hasShopify: status?.connections?.shopify || false,
    isProductCostSetup: status?.isProductCostSetup || false,
    isExtraCostSetup: status?.isExtraCostSetup || false,
    hasMeta: status?.connections?.meta || false,
  };
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
export function useIsStepCompleted(stepName: string) {
  const { completedSteps } = useOnboarding();

  return completedSteps.includes(stepName);
}

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
