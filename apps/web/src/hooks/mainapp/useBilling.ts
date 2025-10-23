"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { api } from "@/libs/convexApi";

export interface BillingStatus {
  hasActivePayment: boolean;
  currentPlan: "free" | "starter" | "growth" | "business";
  subscriptions: Array<{
    id: string;
    name: string;
    test: boolean;
  }>;
}

export interface PlanSelection {
  planName: "Free Plan" | "Starter Plan" | "Growth Plan" | "Business Plan";
  amount: number;
  currency: string;
  description: string;
  features: string[];
  orderLimit: number;
}

export const AVAILABLE_PLANS: PlanSelection[] = [
  {
    planName: "Free Plan",
    amount: 0,
    currency: "USD",
    description: "Perfect for testing Meyoo with small stores",
    features: [
      "Up to 300 orders/month",
      "Basic profit dashboard",
      "Real-time Shopify sync",
      "1 marketing channel",
      "3 free team members",
      "Email support",
    ],
    orderLimit: 300,
  },
  {
    planName: "Starter Plan",
    amount: 40,
    currency: "USD",
    description: "Perfect for growing stores",
    features: [
      "Up to 1,200 orders/month",
      "Advanced cost tracking",
      "3 free team members",
      "$0.20 per extra order",
      "Max $299 overage charge",
    ],
    orderLimit: 1200,
  },
  {
    planName: "Growth Plan",
    amount: 90,
    currency: "USD",
    description: "Most popular - ideal for scaling businesses",
    features: [
      "Advanced analytics",
      "Custom reports",
      "5 free team members",
      "$0.10 per extra order",
      "Max $399 overage charge",
    ],
    orderLimit: 3500,
  },
  {
    planName: "Business Plan",
    amount: 160,
    currency: "USD",
    description: "For high-volume stores",
    features: [
      "Up to 7,500 orders/month",
      "AI-powered insights",
      "Advanced automation",
      "10 free team members",
      "$0.05 per extra order",
      "Max $499 overage charge",
    ],
    orderLimit: 7500,
  },
];

export function useBilling() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch billing metadata for the current organization
  const billingInfo = useQuery(api.core.users.getUserBilling);
  const organization = useQuery(
    api.core.organizationBilling.getOrganizationByUser,
  );

  // Mutations for billing operations
  const updateOrganizationPlan = useMutation(
    api.core.organizationBilling.updateOrganizationPlan,
  );

  const checkBillingStatus = async (
    shop: string,
  ): Promise<BillingStatus | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/billing/check?shop=${encodeURIComponent(shop)}`,
      );

      if (!response.ok) {
        throw new Error(
          `Failed to check billing status: ${response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        hasActivePayment: data.hasActivePayment,
        currentPlan: billingInfo?.plan || "free",
        subscriptions: data.subscriptions || [],
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check billing status";

      setError(errorMessage);

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const requestBilling = async (
    shop: string,
    plan: string,
    returnPath?: string,
  ): Promise<{ confirmationUrl: string; isFree?: boolean } | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/v1/billing/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, plan, returnPath }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        console.error("Billing request failed:", errorData);
        throw new Error(
          errorData.error ||
            `Failed to request billing: ${response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        confirmationUrl: data.confirmationUrl,
        isFree: data.isFree,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to request billing";

      setError(errorMessage);

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getSubscriptions = async (shop: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/billing/subscriptions?shop=${encodeURIComponent(shop)}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to get subscriptions: ${response.statusText}`);
      }

      const data = await response.json();

      return data.subscriptions || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get subscriptions";

      setError(errorMessage);

      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async (
    shop: string,
    subscriptionId: string,
    prorate: boolean = true,
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/v1/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, subscriptionId, prorate }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to cancel subscription: ${response.statusText}`,
        );
      }

      const data = await response.json();

      return data.cancelledSubscription;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel subscription";

      setError(errorMessage);

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const upgradePlan = async (
    newPlan: PlanSelection,
    shop: string,
    returnPath?: string,
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      // Request billing through Shopify (handles both free and paid plans)
      const billingResult = await requestBilling(
        shop,
        newPlan.planName,
        returnPath,
      );

      if (!billingResult) {
        throw new Error("Failed to initiate plan upgrade");
      }

      // For free plans, handle differently
      if (billingResult.isFree) {
        // Update organization plan to free in Convex
        if (organization?._id) {
          await updateOrganizationPlan({
            organizationId: organization._id,
            plan: "free",
            subscriptionPlan: "Free Plan",
          });
        }
      }

      // Redirect to confirmation URL
      // For managed pricing, this will be the Shopify plan selection page
      // For free plan, this will be our onboarding flow
      console.log("Redirecting to:", billingResult.confirmationUrl);

      // Check if we're in an iframe and need to break out
      if (window.top !== window.self) {
        if (window.top) {
          window.top.location.href = billingResult.confirmationUrl;
        }
      } else {
        window.location.href = billingResult.confirmationUrl;
      }

      return billingResult;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to upgrade plan";

      setError(errorMessage);

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const planNameMapping: Record<string, PlanSelection["planName"]> = {
    free: "Free Plan",
    starter: "Starter Plan",
    growth: "Growth Plan",
    business: "Business Plan",
  };

  const currentPlan = (billingInfo?.plan ?? "free") as
    | "free"
    | "starter"
    | "growth"
    | "business";

  const currentPlanDetails = (() => {
    const mappedName = planNameMapping[currentPlan];

    if (!mappedName) {
      return null;
    }

    return (
      AVAILABLE_PLANS.find((plan) => plan.planName === mappedName) || null
    );
  })();

  return {
    // State
    isLoading,
    error,
    billingInfo,
    currentPlan,
    organization,

    // Computed
    currentPlanDetails,
    availablePlans: AVAILABLE_PLANS,

    // Actions
    checkBillingStatus,
    requestBilling,
    getSubscriptions,
    cancelSubscription,
    upgradePlan,

    // Utils
    clearError: () => setError(null),
  };
}
