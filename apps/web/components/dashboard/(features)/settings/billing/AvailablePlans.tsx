"use client";
import { Button, Chip, Divider, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Available Plans
        </h3>
        <p className="text-sm text-default-500 mt-1">
          Upgrade or downgrade your subscription anytime
        </p>
      </div>

      <Divider className="bg-divider" />

      {/* Error Display */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
          <div className="flex gap-3">
            <Icon
              className="text-danger shrink-0"
              icon="solar:danger-bold"
              width={20}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Billing Error
              </p>
              <p className="text-xs text-default-500">{error}</p>
              <Button
                color="danger"
                size="sm"
                startContent={<Icon icon="solar:refresh-linear" width={16} />}
                variant="flat"
                onPress={clearError}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Frequency Toggle */}
      <div className="flex justify-center">
        <Tabs
          classNames={{
            base: "border border-default-300 rounded-full",
            tab: "data-[hover-unselected=true]:opacity-90 font-medium ",
            tabList: "bg-default-100",
          }}
          radius="full"
          size="md"
          onSelectionChange={onFrequencyChange}
        >
          <Tab key={FrequencyEnum.Monthly} title="Monthly" />
          <Tab
            key={FrequencyEnum.Yearly}
            title={
              <div className="flex items-center gap-2">
                <span>Yearly</span>
                <Chip className="bg-success/10 text-success" size="sm">
                  Save 25%
                </Chip>
              </div>
            }
          />
        </Tabs>
      </div>

      {/* Plans Grid - Updated to handle 4 plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {availablePlans.map((tier) => (
          <div
            key={tier.key}
            className="relative flex flex-col bg-content1 dark:bg-content2 rounded-2xl p-6 border border-default-200/50 hover:border-default-200 hover:shadow-none transition-all duration-300"
          >
            {tier.mostPopular && (
              <Chip
                className="absolute -top-3 left-1/2 -translate-x-1/2"
                color="primary"
                size="sm"
                variant="flat"
              >
                Most Popular
              </Chip>
            )}

            <div className="mb-4">
              <h4 className="text-lg font-semibold text-foreground">
                {tier.title}
              </h4>
              <p className="text-sm text-default-500 mt-1">
                {tier.description}
              </p>
            </div>

            <div className="mb-6">
              <p className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">
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

            <ul className="space-y-2 mb-6 flex-grow">
              {tier.features?.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Icon
                    className="text-success shrink-0 mt-0.5"
                    icon="solar:check-circle-bold"
                    width={16}
                  />
                  <span className="text-xs text-default-600">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              fullWidth
              color={
                tier.title.toLowerCase() === currentPlan.toLowerCase()
                  ? "success"
                  : tier.mostPopular
                    ? "primary"
                    : "default"
              }
              disabled={(() => {
                const isCurrentPlan =
                  tier.title.toLowerCase() === currentPlan.toLowerCase();
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
                tier.title.toLowerCase() !== currentPlan.toLowerCase() && (
                  <Icon icon="solar:arrow-right-linear" width={16} />
                )
              }
              size="sm"
              variant={
                tier.title.toLowerCase() === currentPlan.toLowerCase()
                  ? "solid"
                  : tier.mostPopular
                    ? "solid"
                    : "flat"
              }
              onPress={() => {
                if (tier.title.toLowerCase() !== currentPlan.toLowerCase()) {
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
                const isCurrentPlan =
                  tier.title.toLowerCase() === currentPlan.toLowerCase();
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
                  return `Cannot downgrade (${currentOrderUsage} orders > ${tierLimit} limit)`;
                }

                if (isLoading) return "Processing...";
                return isDowngrade
                  ? `Downgrade to ${tier.title}`
                  : `Upgrade to ${tier.title}`;
              })()}
            </Button>
          </div>
        ))}
      </div>

      {/* Free Tier Notice */}
      <div className="bg-success/10 border border-success/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Icon
            className="text-success shrink-0"
            icon="solar:gift-bold"
            width={20}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Free for small stores
            </p>
            <p className="text-xs text-default-500">
              Meyoo is completely free for stores with less than 300 orders per
              month. No credit card required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
