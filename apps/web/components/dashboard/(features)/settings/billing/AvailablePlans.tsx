"use client";
import { Button, Chip, Tab, Tabs, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { BadgeCheck } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";

import { frequencies, tiers } from "@/components/home/pricing/constants";
import { type Frequency, FrequencyEnum } from "@/components/home/pricing/types";
import { api } from "@/libs/convexApi";
import { AVAILABLE_PLANS, useBilling } from "@/hooks";

export default function AvailablePlans() {
  const { currentUsage, isLoading, error, upgradePlan, clearError } =
    useBilling();

  // Get current shop domain
  const shopDomainData = useQuery(
    api.core.shopDomainHelper.getCurrentShopDomain
  );

  const currentPlan = currentUsage?.plan || "free";
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
    <div className="space-y-4 bg-background">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          Upgrade Plan
        </h3>
        {/* Frequency Toggle - Inline */}
        <Tabs
          radius="full"
          size="sm"
          onSelectionChange={onFrequencyChange}
        >
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {availablePlans.map((tier) => {
          const isCurrentPlan = tier.title.toLowerCase() === currentPlan.toLowerCase();

          return (
            <div
              key={tier.key}
              className={`relative flex flex-col rounded-3xl pb-2 border bg-background ${
                tier.mostPopular ? "border-2 border-primary" : isCurrentPlan ? "border-2 border-success" : "border border-default-200/50"
              }`}
            >

              <div className="flex flex-col px-6 py-4">
                <h3 className="text-lg font-medium text-foreground">
                  {tier.title}
                </h3>
                <div className="mt-4 gap-2 flex flex-col">
                  <div className="text-4xl font-semibold tracking-tight text-foreground/90">
                    {typeof tier.price === "string"
                      ? tier.price
                      : tier.price[selectedFrequency.key]}
                  </div>
                  <div className="text-xs text-default-500">
                    per {selectedFrequency.priceSuffix}
                  </div>
                </div>

                <p className="text-sm mt-4 text-muted-foreground">
                  {tier.description}
                </p>

                <Button
                  fullWidth
                  color={
                    isCurrentPlan
                      ? "success"
                      : tier.mostPopular
                        ? "primary"
                        : "default"
                  }
                  disabled={(() => {
                    if (isCurrentPlan || isLoading) return true;

                    // Check if downgrade is blocked due to usage
                    const tierLimits: Record<string, number> = {
                      free: 300,
                      starter: 1200,
                      growth: 3500,
                      business: 7500,
                    };

                    const tierLimit = tierLimits[tier.title.toLowerCase()] || 0;
                    const currentOrderUsage = currentUsage?.currentUsage || 0;

                    const planOrder = ["free", "starter", "growth", "business"];
                    const currentPlanIndex = planOrder.indexOf(
                      currentPlan.toLowerCase()
                    );
                    const tierIndex = planOrder.indexOf(tier.title.toLowerCase());
                    const isDowngrade = tierIndex < currentPlanIndex;

                    // Disable if downgrading and usage exceeds lower plan limit
                    return isDowngrade && currentOrderUsage > tierLimit;
                  })()}
                  isLoading={loadingTier === (tier.title + " Plan")}
                  endContent={
                    !isCurrentPlan && (
                      <Icon icon="solar:arrow-right-linear" width={14} />
                    )
                  }
                  size="sm"
                  variant={
                    isCurrentPlan
                      ? "solid"
                      : tier.mostPopular
                        ? "solid"
                        : "flat"
                  }
                  className="mt-2 h-9"
                  onPress={() => {
                    if (!isCurrentPlan) {
                      // Map tier to Shopify plan name using stable identifiers
                      // Use key mapping aligned with TiersEnum
                      const planMappingByKey: Record<string, string> = {
                        free: "Free Plan",
                        pro: "Starter Plan",
                        team: "Growth Plan",
                        custom: "Business Plan",
                        enterprise: "Enterprise Plan",
                      };

                      // Fallback: map by title in case keys change
                      const planMappingByTitle: Record<string, string> = {
                        free: "Free Plan",
                        starter: "Starter Plan",
                        growth: "Growth Plan",
                        business: "Business Plan",
                        enterprise: "Enterprise Plan",
                      };

                      const key = String(tier.key).toLowerCase();
                      const title = tier.title.toLowerCase();
                      const shopifyPlanName =
                        planMappingByKey[key] || planMappingByTitle[title];

                      if (shopifyPlanName) {
                        handlePlanUpgrade(shopifyPlanName);
                      }
                    }
                  }}
                >
                  {(() => {
                    if (isCurrentPlan) return "Current Plan";

                    // Get tier's order limit
                    const tierLimits: Record<string, number> = {
                      free: 300,
                      starter: 1200,
                      growth: 3500,
                      business: 7500,
                    };

                    const tierLimit = tierLimits[tier.title.toLowerCase()] || 0;
                    const currentOrderUsage = currentUsage?.currentUsage || 0;

                    // Check if this is a downgrade
                    const planOrder = ["free", "starter", "growth", "business"];
                    const currentPlanIndex = planOrder.indexOf(
                      currentPlan.toLowerCase()
                    );
                    const tierIndex = planOrder.indexOf(tier.title.toLowerCase());
                    const isDowngrade = tierIndex < currentPlanIndex;

                    // Prevent downgrade if current usage exceeds the lower plan's limit
                    if (isDowngrade && currentOrderUsage > tierLimit) {
                      return `Over limit for downgrade`;
                    }

                    if (isLoading) return "Processing...";
                    return isDowngrade ? `Switch to ${tier.title}` : `Upgrade to ${tier.title}`;
                  })()}
                </Button>
              </div>

              <Divider className="my-2" />

              <div className="flex flex-col justify-between px-6 pt-2 pb-4">
                <ul className="space-y-3">
                  {tier.features?.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <BadgeCheck className="size-5 text-muted-foreground shrink-0" />
                      <span className="ml-3 text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
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
          <p className="text-xs text-default-600">
            <span className="font-medium text-foreground">Free for small stores:</span>{" "}
            Meyoo is free for stores with less than 300 orders/month. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
