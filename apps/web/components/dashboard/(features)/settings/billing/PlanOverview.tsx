"use client";
import { Chip, Divider, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

import { tiers } from "@/components/home/pricing/constants";
import { PlanOverviewSkeleton } from "@/components/shared/skeletons";
import { api } from "@/libs/convexApi";
import { useBilling } from "@/hooks";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "@/hooks/mainapp/useUser";

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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Current Plan
          </h3>
          <p className="text-sm text-default-500 mt-1">
            You are currently on the {currentPlan?.title || "Free"} plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip
            color={currentPlanName === "free" ? "default" : "primary"}
            size="sm"
            startContent={
              currentPlanName !== "free" && (
                <Icon icon="solar:crown-star-bold" width={16} />
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
                <Icon icon="solar:hourglass-line-linear" width={14} />
              }
              variant="flat"
            >
              Trial: {billingUsage.daysLeftInTrial} days left
            </Chip>
          )}
        </div>
      </div>

      <Divider className="bg-divider" />

      {/* Simple Usage Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Current Usage */}
        <div>
          <p className="text-sm text-default-600 mb-2">Monthly Usage</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">
                {currentUsage.orders.toLocaleString()} /{" "}
                {currentUsage.ordersLimit.toLocaleString()} orders
              </span>
              <span className="text-xs text-default-500">
                {Math.round(
                  getUsagePercentage(
                    currentUsage.orders,
                    currentUsage.ordersLimit,
                  ),
                )}
                %
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
        </div>

        {/* Billing Info */}
        <div>
          <p className="text-sm text-default-600 mb-2">Billing Details</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-default-500">Amount</span>
              <span className="text-sm font-medium text-foreground">
                {getPlanPrice(currentPlanName)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-default-500">
                {billingUsage?.isOnTrial ? "Trial ends" : "Next billing"}
              </span>
              <span className="text-sm font-medium text-foreground">
                {billingUsage?.isOnTrial && billingUsage.trialEndsAt
                  ? new Date(billingUsage.trialEndsAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )
                  : getNextBillingDate()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Recommendation */}
      {upgradeRecommendation && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <div className="flex gap-3">
            <Icon
              className="text-warning shrink-0"
              icon="solar:danger-triangle-bold"
              width={20}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Consider upgrading to{" "}
                {upgradeRecommendation.planName.replace(" Plan", "")}
              </p>
              <p className="text-xs text-default-500">
                You&apos;re approaching your plan limit. Upgrade to{" "}
                {upgradeRecommendation.planName.replace(" Plan", "")}
                for {upgradeRecommendation.orderLimit.toLocaleString()}{" "}
                orders/month at ${upgradeRecommendation.amount}/month.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Features */}
      <div className="bg-content2 rounded-lg p-4">
        <p className="text-sm font-medium text-foreground mb-3">
          Your plan includes:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {currentPlan?.features?.slice(0, 4).map((feature) => (
            <div
              key={`current-plan-feature-${feature}`}
              className="flex items-center gap-2"
            >
              <Icon
                className="text-success shrink-0"
                icon="solar:check-circle-bold"
                width={14}
              />
              <span className="text-xs text-default-600">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
