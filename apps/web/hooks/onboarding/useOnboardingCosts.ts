import { useMutation } from "convex/react";
import { api } from "@/libs/convexApi";

/**
 * Hook for managing initial cost setup during onboarding
 * Simplified to only expose saveInitialCosts
 */
export function useOnboardingCosts() {
  const saveInitialCostsMutation = useMutation(
    api.core.onboarding.saveInitialCosts,
  );

  const saveInitialCosts = async (costs: {
    shippingCost?: number;
    paymentFeePercent?: number;
    operatingCosts?: number;
    manualReturnRate?: number;
  }) => {
    try {
      const result = await saveInitialCostsMutation(costs);
      return result;
    } catch (error) {
      console.error("Failed to save initial costs:", error);
      throw error;
    }
  };

  return {
    saveInitialCosts,
  };
}
