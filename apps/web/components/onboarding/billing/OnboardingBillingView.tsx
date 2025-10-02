"use client";

import { addToast, Chip, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { frequencies, tiers } from "@/components/home/pricing/constants";
import {
  type Frequency,
  FrequencyEnum,
  TiersEnum,
} from "@/components/home/pricing/types";
import { api } from "@/libs/convexApi";
import { AVAILABLE_PLANS, useBilling } from "@/hooks";
import NavigationButtons from "@/components/onboarding/NavigationButtons";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";
import { PricingTierCard } from "@/components/shared/billing/PricingTierCard";
import {
  SHOPIFY_PLAN_NAME_BY_TIER_KEY,
  getTierKeyFromPlanName,
} from "@/components/shared/billing/planUtils";

export default function OnboardingBillingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentPlan, upgradePlan, clearError } = useBilling();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const setNavigationPending = useSetAtom(setNavigationPendingAtom);
  // CompleteBillingStep mutation is not used; billing completion is reflected via webhooks.

  // Page-level server component handles redirect based on onboarding table.

  // Get shop domain from URL params (fallback to query)
  const shopFromUrl = searchParams.get("shop");

  // Get current shop domain from database
  const shopDomainData = useQuery(
    api.core.shopDomainHelper.getCurrentShopDomain
  );

  // Live onboarding status (Convex query) to auto-redirect when state updates via webhook/verify
  const onboardingStatus = useQuery(api.core.onboarding.getOnboardingStatus);

  // No default plan; if none selected, treat as no active plan
  const _currentPlan = currentPlan ?? null;
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>(
    (frequencies[0] as Frequency) ?? (frequencies[0] as Frequency)
  );

  // Prefetch next pages to make redirects snappy
  useEffect(() => {
    try {
      router.prefetch("/onboarding/marketing");
      router.prefetch("/overview");
    } catch {
      // Intentionally ignore prefetch errors
    }
  }, [router]);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("billing");
  }, []);

  // Auto-redirect only when onboarding status changes (after successful subscription)
  useEffect(() => {
    if (!onboardingStatus) return;

    // Only redirect if onboarding is complete or subscription is active
    if (onboardingStatus.completed) {
      router.replace("/overview");
    }
  }, [onboardingStatus, router]);

  const handlePlanUpgrade = async (planName: string, tierKey: string) => {
    clearError();
    setLoadingPlan(tierKey);

    try {
      setNavigationPending(true);
      trackOnboardingAction("billing", "select_plan", {
        plan: planName,
        tier: tierKey,
        frequency: selectedFrequency.key,
      });
      // Redirect all plans (including Free) to Shopify Managed Pricing
      const plan = AVAILABLE_PLANS.find((p) => p.planName === planName);

      if (!plan) {
        console.error("Plan not found:", planName);

        return;
      }

      // Get shop domain - prioritize URL param (from redirect) then database
      const shopDomain = shopFromUrl || shopDomainData;

      if (!shopDomain) {
        addToast({
          title: "Shopify connection required",
          description: "Please connect your Shopify store first",
          color: "danger",
          timeout: 5000,
        });
        console.error(
          "No shop domain found for billing - ensure Shopify is connected"
        );

        return;
      }

      // The upgradePlan function will request managed pricing and handle redirect
      console.log(
        "Selecting plan via Shopify Managed Pricing:",
        planName,
        "Shop:",
        shopDomain
      );
      await upgradePlan(plan, shopDomain, "/onboarding/marketing");
    } catch (error) {
      console.error("Plan upgrade failed:", error);
      addToast({
        title: "Plan selection failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        color: "danger",
        timeout: 5000,
      });
      // Only clear pending state if we handled the error locally (no redirect)
      setNavigationPending(false);
    } finally {
      setLoadingPlan(null);
    }
  };

  const onFrequencyChange = (selectedKey: React.Key) => {
    const frequencyIndex = frequencies.findIndex((f) => f.key === selectedKey);
    setSelectedFrequency(
      (frequencies[frequencyIndex] ?? frequencies[0]) as Frequency
    );
  };

  // Show all plans including free for explicit selection
  const availablePlans = tiers;
  // Determine active plan tier key for highlighting
  const activeTierKey = useMemo(() => {
    const tier = getTierKeyFromPlanName(currentPlan ?? null);
    return tier ?? "";
  }, [currentPlan]);
  // Avoid duplicate client-side redirects; trust server redirect.

  return (
    <div className="mx-auto w-full py-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
          Choose Your Plan
        </h1>
        <p className="text-lg text-default-600">
          Select a plan to unlock all features and continue growing your
          business
        </p>
      </div>

      {/* Billing Frequency Toggle */}
      <div className="flex items-center justify-center gap-3 text-sm text-default-600">
        <span className="font-medium text-foreground">Monthly</span>
        <Switch
          isSelected={selectedFrequency.key === FrequencyEnum.Yearly}
          onValueChange={(isSelected) =>
            onFrequencyChange(
              isSelected ? FrequencyEnum.Yearly : FrequencyEnum.Monthly
            )
          }
          size="sm"
        />
        <div className="flex items-center gap-1">
          <span className="font-medium text-foreground">Yearly</span>
          <Chip color="success" size="sm" variant="flat">
            Save 2 Months
          </Chip>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {availablePlans.map((tier) => {
          const isActive = tier.key === activeTierKey;
          const isLoadingTier = loadingPlan === tier.key;
          return (
            <PricingTierCard
              key={tier.key}
              tier={tier}
              selectedFrequency={selectedFrequency}
              highlight={isActive ? "active" : null}
              button={{
                label: isActive
                  ? "Active Plan"
                  : isLoadingTier
                    ? "Processing..."
                    : tier.key === TiersEnum.Free
                      ? "Continue with Free"
                      : `Select ${tier.title}`,
                color: isActive
                  ? "success"
                  : tier.key === TiersEnum.Free
                    ? "default"
                    : "primary",
                variant: isActive
                  ? "solid"
                  : tier.key === TiersEnum.Free
                    ? "flat"
                    : "flat",
                disabled: isActive || isLoadingTier,
                isLoading: isLoadingTier,
                endContent:
                  isActive || isLoadingTier ? undefined : (
                    <Icon icon="solar:arrow-right-linear" width={16} />
                  ),
                onPress: () => {
                  if (isActive || isLoadingTier) return;
                  const planName = SHOPIFY_PLAN_NAME_BY_TIER_KEY[tier.key];
                  if (planName) {
                    void handlePlanUpgrade(planName, tier.key);
                  }
                },
              }}
            />
          );
        })}
      </div>

      {/* Current Plan Status */}
      <div className="flex items-center justify-between">
        <Chip color="default" size="sm" variant="flat">
          {(() => {
            const map: Record<string, string> = {
              free: "Free Plan",
              starter: "Starter Plan",
              growth: "Growth Plan",
              business: "Business Plan",
            };
            const label = currentPlan
              ? map[String(currentPlan)] || String(currentPlan)
              : null;
            return `Current Plan: ${label ?? "Not selected"}`;
          })()}
        </Chip>
        {onboardingStatus?.hasShopifySubscription && (
          <NavigationButtons
            variant="inline"
            nextLabel="Continue"
            onNext={() => {
              trackOnboardingAction("billing", "continue");
              return true;
            }}
          />
        )}
      </div>
    </div>
  );
}
