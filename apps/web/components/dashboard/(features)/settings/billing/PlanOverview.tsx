"use client";
import { Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

import { tiers } from "@/components/home/pricing/constants";
import { PlanOverviewSkeleton } from "@/components/shared/skeletons";
import { api } from "@/libs/convexApi";
import { useBilling } from "@/hooks";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "@/hooks/mainapp/useUser";
import { formatNumber } from "@/libs/utils/format";

export default function PlanOverview() {
  const { timezone } = useOrganizationTimeZone();
  const { currentUsage: billingUsage, upgradeRecommendation } = useBilling();
  // Read authoritative billing info directly
  const userBilling = useQuery(api.core.users.getUserBilling);

  // Get current month's metrics for order count
  const { startOfMonth, endOfMonth } = useMemo(() => {
    const currentDate = new Date();

    return {
      startOfMonth: new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      ),
      endOfMonth: new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      ),
    };
  }, []);

  const dashboardSummary = useQuery(api.web.dashboard.getDashboardSummary, {
    ...toUtcRangeStrings({
      startDate: startOfMonth.toISOString().slice(0, 10),
      endDate: endOfMonth.toISOString().slice(0, 10),
    }, timezone),
  });

  // Get current plan from billing usage (more accurate)
  const currentPlanName = userBilling?.plan || billingUsage?.plan || "free";
  const currentPlan = useMemo(
    () =>
      tiers.find(
        (tier) => tier.title.toLowerCase() === currentPlanName.toLowerCase(),
      ),
    [currentPlanName],
  );

  // Get plan limits based on current plan (matching database/constants)
  const getPlanOrderLimit = useMemo(
    () => (plan: string) => {
      const limits: Record<string, number> = {
        free: 300,
        starter: 1200,
        growth: 3500,
        business: 7500,
      };

      return limits[plan] || 300;
    },
    [],
  );

  const currentUsage = useMemo(
    () => ({
      orders: billingUsage?.currentUsage || dashboardSummary?.orders || 0,
      ordersLimit: billingUsage?.limit || getPlanOrderLimit(currentPlanName),
    }),
    [
      billingUsage?.currentUsage,
      billingUsage?.limit,
      dashboardSummary?.orders,
      getPlanOrderLimit,
      currentPlanName,
    ],
  );

  // Calculate next billing date (first day of next month)
  const getNextBillingDate = useMemo(
    () => () => {
      const nextMonth = new Date();

      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);

      return nextMonth.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    },
    [],
  );

  // Get plan price (matching constants)
  const getPlanPrice = useMemo(
    () => (plan: string) => {
      const prices: Record<string, string> = {
        free: "$0/month",
        starter: "$40/month",
        growth: "$90/month",
        business: "$160/month",
      };

      return prices[plan] || "$0/month";
    },
    [],
  );

  const getUsagePercentage = useMemo(
    () => (current: number, limit: number) => {
      return (current / limit) * 100;
    },
    [],
  );

  // Show skeleton while loading
  if (dashboardSummary === undefined || userBilling === undefined) {
    return <PlanOverviewSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">
            Current Plan
          </h3>
          <Chip
            color={currentPlanName === "free" ? "default" : "primary"}
            size="sm"
            startContent={
              currentPlanName !== "free" && (
                <Icon icon="solar:crown-star-bold" width={14} />
              )
            }
            variant="flat"
          >
            {currentPlan?.title || "Free"}
          </Chip>
          {billingUsage?.isOnTrial && (
            <Chip
              color="warning"
              size="sm"
              startContent={
                <Icon icon="solar:hourglass-line-linear" width={12} />
              }
              variant="flat"
            >
              Trial: {billingUsage.daysLeftInTrial} days left
            </Chip>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {getPlanPrice(currentPlanName)}
          </p>
          <p className="text-xs text-default-500">
            {billingUsage?.isOnTrial ? "Trial ends" : "Next billing"}:{" "}
            {billingUsage?.isOnTrial && billingUsage.trialEndsAt
              ? new Date(billingUsage.trialEndsAt).toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                  },
                )
              : new Date(getNextBillingDate()).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
          </p>
        </div>
      </div>

      {/* Compact Usage Display */}
      <div className="bg-content1 rounded-lg px-3 py-2.5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-default-600">Monthly Usage</span>
          <span className="text-xs font-medium text-foreground">
            {formatNumber(currentUsage.orders)} / {formatNumber(currentUsage.ordersLimit)} orders
            <span className="text-default-500 ml-2">
              ({Math.round(
                getUsagePercentage(
                  currentUsage.orders,
                  currentUsage.ordersLimit,
                ),
              )}%)
            </span>
          </span>
        </div>
        <Progress
          classNames={{
            base: "max-w-full",
            indicator: "bg-gradient-to-r",
          }}
          color={
            getUsagePercentage(
              currentUsage.orders,
              currentUsage.ordersLimit,
            ) > 80
              ? "warning"
              : "primary"
          }
          size="sm"
          value={getUsagePercentage(
            currentUsage.orders,
            currentUsage.ordersLimit,
          )}
        />
      </div>

      {/* Upgrade Recommendation */}
      {upgradeRecommendation && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
          <div className="flex gap-2.5 items-start">
            <Icon
              className="text-warning shrink-0 mt-0.5"
              icon="solar:danger-triangle-bold"
              width={16}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">
                Consider upgrading to{" "}
                {upgradeRecommendation.planName.replace(" Plan", "")}
                {" "}
                <span className="text-default-500">
                  ({formatNumber(upgradeRecommendation.orderLimit)} orders/mo
                  at ${upgradeRecommendation.amount}/mo)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Features - Compact */}
      <div className="flex flex-wrap gap-2">
        {currentPlan?.features?.map((feature) => (
          <Chip
            key={`current-plan-feature-${feature}`}
            size="sm"
            startContent={
              <Icon
                className="text-success"
                icon="solar:check-circle-bold"
                width={12}
              />
            }
            variant="flat"
            className="bg-content2 text-xs"
          >
            {feature}
          </Chip>
        ))}
      </div>
    </div>
  );
}
