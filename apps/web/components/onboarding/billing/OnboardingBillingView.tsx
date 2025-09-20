"use client";

import { addToast, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { frequencies, tiers } from "@/components/home/pricing/constants";
import { type Frequency, FrequencyEnum } from "@/components/home/pricing/types";
import { api } from "@/libs/convexApi";
import { AVAILABLE_PLANS, useBilling } from "@/hooks";
import NavigationButtons from "@/components/onboarding/NavigationButtons";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

export default function OnboardingBillingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUsage, upgradePlan, clearError } = useBilling();
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
  const _currentPlan = currentUsage?.plan ?? null;
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>(
    (frequencies[0] as Frequency) ?? (frequencies[0] as Frequency)
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
  const planName = String(currentUsage?.plan || "").toLowerCase();
  const planToTier: Record<string, string> = {
    "free plan": "free",
    "starter plan": "pro",
    "growth plan": "team",
    "business plan": "custom",
  };
  const activeTierKey = planToTier[planName]
    || (planName.includes("free") ? "free"
      : planName.includes("starter") ? "pro"
      : planName.includes("growth") ? "team"
      : planName.includes("business") || planName.includes("custom") ? "custom" : "");
  // Avoid duplicate client-side redirects; trust server redirect.

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
          Choose Your Plan
        </h1>
        <p className="text-lg text-default-600">
          Select a plan to unlock all features and continue growing your business
        </p>
      </div>

      {/* Frequency Toggle (no Tabs to avoid collection runtime issues) */}
      <div className="flex justify-center">
        {mounted ? (
          <div className="inline-flex items-center gap-1 bg-default-100 rounded-full p-1">
            <Button
              size="sm"
              radius="full"
              variant={selectedFrequency.key === FrequencyEnum.Monthly ? "solid" : "flat"}
              color={selectedFrequency.key === FrequencyEnum.Monthly ? "primary" : "default"}
              onPress={() => onFrequencyChange(FrequencyEnum.Monthly)}
              className="font-medium"
            >
              Monthly
            </Button>
            <Button
              size="sm"
              radius="full"
              variant={selectedFrequency.key === FrequencyEnum.Yearly ? "solid" : "flat"}
              color={selectedFrequency.key === FrequencyEnum.Yearly ? "primary" : "default"}
              onPress={() => onFrequencyChange(FrequencyEnum.Yearly)}
              className="font-medium"
              endContent={
                <Chip color="success" size="sm" variant="flat">
                  Save 2 Months
                </Chip>
              }
            >
              Yearly
            </Button>
          </div>
        ) : (
          <div className="h-10" />
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {availablePlans.map((tier) => (
          <div
            key={tier.key}
            className={`relative flex flex-col bg-content2 dark:bg-content1 rounded-xl py-5 px-6 border transition-all duration-300 min-w-0 ${tier.key === activeTierKey ? 'border-primary ring-1 ring-primary/30' : 'border-default-100 hover:border-primary'}`}
          >
            {(tier.mostPopular || tier.key === activeTierKey) && (
              <Chip
                className="absolute -top-3 left-1/2 -translate-x-1/2"
                color={tier.key === activeTierKey ? "success" : "primary"}
                size="sm"
              >
                {tier.key === activeTierKey ? 'Active' : 'Most Popular'}
              </Chip>
            )}

            <div className="mb-3">
              <h4 className="text-lg font-semibold text-foreground">
                {tier.title}
              </h4>
              <p className="text-sm text-default-500 mt-1">
                {tier.description}
              </p>
            </div>

            <div className="mb-4">
              <p className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {typeof tier.price === "string"
                    ? tier.price
                    : tier.price[selectedFrequency.key]}
                </span>
                {typeof tier.price !== "string" && (
                  <span className="text-sm text-default-500">
                    /{selectedFrequency.priceSuffix}
                  </span>
                )}
              </p>
            </div>

            <ul className="space-y-1.5 mb-4 flex-grow">
              {tier.features?.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Icon
                    className="text-success shrink-0 mt-0.5"
                    icon="solar:check-circle-bold"
                    width={14}
                  />
                  <span className="text-xs text-default-600 leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              fullWidth
              color={
                tier.key === "free"
                  ? "default"
                  : tier.mostPopular
                    ? "primary"
                    : "primary"
              }
              disabled={loadingPlan === tier.key || tier.key === activeTierKey}
              endContent={tier.key === activeTierKey ? undefined : <Icon icon="solar:arrow-right-linear" width={16} />}
              variant={
                tier.key === "free"
                  ? "flat"
                  : tier.mostPopular
                    ? "solid"
                    : "flat"
              }
              onPress={() => {
                // Map tier key to Shopify plan name
                const planMapping: Record<string, string> = {
                  free: "Free Plan",
                  pro: "Starter Plan",
                  team: "Growth Plan",
                  custom: "Business Plan",
                };
                const shopifyPlanName = planMapping[tier.key];

                if (shopifyPlanName) {
                  handlePlanUpgrade(shopifyPlanName, tier.key);
                }
              }}
            >
              {tier.key === activeTierKey
                ? 'Active Plan'
                : loadingPlan === tier.key
                  ? 'Processing...'
                  : tier.key === 'free'
                    ? 'Continue with Free'
                    : `Select ${tier.title}`}
            </Button>
          </div>
        ))}
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
            const label = currentUsage?.plan ? map[String(currentUsage.plan)] || String(currentUsage.plan) : null;
            return `Current Plan: ${label ?? 'Not selected'}`;
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
