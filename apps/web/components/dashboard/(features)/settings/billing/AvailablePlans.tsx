"use client";
import { Button, Chip, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";

import { frequencies, tiers } from "@/components/home/pricing/constants";
import {
  type Frequency,
  FrequencyEnum,
  TiersEnum,
} from "@/components/home/pricing/types";
import { api } from "@/libs/convexApi";
import { AVAILABLE_PLANS, useBilling } from "@/hooks";
import { PricingTierCard } from "@/components/shared/billing/PricingTierCard";
import {
  SHOPIFY_PLAN_NAME_BY_TIER_KEY,
  getTierKeyFromPlanName,
} from "@/components/shared/billing/planUtils";

const PLAN_ORDER: TiersEnum[] = [
  TiersEnum.Free,
  TiersEnum.Pro,
  TiersEnum.Team,
  TiersEnum.Custom,
  TiersEnum.Enterprise,
];

export default function AvailablePlans() {
  const { currentPlan, isLoading, error, upgradePlan, clearError } =
    useBilling();

  // Get current shop domain
  const shopDomainData = useQuery(
    api.core.shopDomainHelper.getCurrentShopDomain
  );

  const currentTierKey = useMemo(() => {
    const tier = getTierKeyFromPlanName(currentPlan ?? null);
    return tier ?? TiersEnum.Free;
  }, [currentPlan]);
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>(
    (frequencies[0] as Frequency) ?? (frequencies[0] as Frequency)
  );
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const setPending = useSetAtom(setSettingsPendingAtom);

  const handlePlanUpgrade = async (planName: string) => {
    clearError();
    setPending(true);

    const plan = AVAILABLE_PLANS.find((p) => p.planName === planName);

    if (!plan) {
      console.error("Plan not found:", planName);

      return;
    }

    // Get shop domain from query
    const shopDomain = shopDomainData;

    if (!shopDomain) {
      console.error(
        "No shop domain found for billing - ensure Shopify is connected"
      );

      return;
    }

    try {
      setLoadingTier(planName);
      await upgradePlan(plan, shopDomain, "/settings/billing-invoices");
    } finally {
      // Keep pending on; upgrade may redirect externally. If it doesn't, clear.
      setLoadingTier(null);
      setPending(false);
    }
  };

  const onFrequencyChange = (selectedKey: React.Key) => {
    const frequencyIndex = frequencies.findIndex((f) => f.key === selectedKey);
    setSelectedFrequency(
      (frequencies[frequencyIndex] ?? frequencies[0]) as Frequency
    );
  };

  // Show all plans (no filtering) - all 5 tiers
  const availablePlans = tiers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-default-800">
          Upgrade Plan
        </h3>
        {/* Frequency Toggle - Inline */}
        <Tabs radius="full" size="sm" onSelectionChange={onFrequencyChange}>
          <Tab key={FrequencyEnum.Monthly} title="Monthly" />
          <Tab
            key={FrequencyEnum.Yearly}
            title={
              <div className="flex items-center gap-1.5">
                <span>Yearly</span>
                <Chip color="success" size="sm" variant="flat">
                  -25%
                </Chip>
              </div>
            }
          />
        </Tabs>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
          <div className="flex gap-2.5">
            <Icon
              className="text-danger shrink-0 mt-0.5"
              icon="solar:danger-bold"
              width={16}
            />
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium text-foreground">
                Billing Error: {error}
              </p>
              <Button
                color="danger"
                size="sm"
                startContent={<Icon icon="solar:refresh-linear" width={14} />}
                variant="flat"
                className="h-6 text-xs px-2"
                onPress={clearError}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid with Full Features - Matching Home Pricing Style */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {availablePlans.map((tier) => {
          const planName = SHOPIFY_PLAN_NAME_BY_TIER_KEY[tier.key];
          const isCurrentPlan = tier.key === currentTierKey;
          const currentPlanIndex = PLAN_ORDER.indexOf(currentTierKey);
          const tierIndex = PLAN_ORDER.indexOf(tier.key);
          const isDowngrade =
            tierIndex !== -1 &&
            currentPlanIndex !== -1 &&
            tierIndex < currentPlanIndex;

          const isProcessing = loadingTier === planName;
          const disabled = isCurrentPlan || isLoading || isProcessing;

          const buttonLabel = (() => {
            if (isCurrentPlan) return "Current Plan";
            if (isProcessing) return "Processing...";
            if (isLoading) return "Processing...";
            return isDowngrade
              ? `Switch to ${tier.title}`
              : `Upgrade to ${tier.title}`;
          })();

          return (
            <PricingTierCard
              key={tier.key}
              tier={tier}
              selectedFrequency={selectedFrequency}
              highlight={
                isCurrentPlan ? "active" : tier.mostPopular ? "popular" : null
              }
              button={{
                label: buttonLabel,
                size: "sm",
                className: "h-9",
                color: isCurrentPlan
                  ? "success"
                  : tier.key === TiersEnum.Free
                    ? "default"
                    : "primary",
                variant: isCurrentPlan
                  ? "solid"
                  : tier.mostPopular
                    ? "solid"
                    : "flat",
                disabled,
                isLoading: isProcessing,
                endContent:
                  disabled || !planName || isCurrentPlan
                    ? undefined
                    : (
                        <Icon icon="solar:arrow-right-linear" width={14} />
                      ),
                onPress: () => {
                  if (!planName || disabled) return;
                  void handlePlanUpgrade(planName);
                },
              }}
            />
          );
        })}
      </div>

      {/* Free Tier Notice - Compact */}
      <div className="bg-success/10 border border-success/20 rounded-lg p-3">
        <div className="flex gap-2.5 items-start">
          <Icon
            className="text-success shrink-0 mt-0.5"
            icon="solar:gift-bold"
            width={16}
          />
          <p className="text-xs text-default-700">
            <span className="font-medium text-foreground">
              Free for small stores:
            </span>{" "}
            Meyoo is free for stores with less than 300 orders/month. No credit
            card required.
          </p>
        </div>
      </div>
    </div>
  );
}
