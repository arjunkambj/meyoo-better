"use client";

import { useMemo } from "react";

import { Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { tiers } from "@/components/home/pricing/constants";
import { TiersEnum } from "@/components/home/pricing/types";
import { PlanOverviewSkeleton } from "@/components/shared/skeletons";
import { api } from "@/libs/convexApi";

type PlanKey = "free" | "starter" | "growth" | "business";

const PLAN_KEY_TO_LABEL: Record<PlanKey, string> = {
  free: "Free Plan",
  starter: "Starter Plan",
  growth: "Growth Plan",
  business: "Business Plan",
};

const PLAN_KEY_TO_TIER: Record<PlanKey, TiersEnum> = {
  free: TiersEnum.Free,
  starter: TiersEnum.Pro,
  growth: TiersEnum.Team,
  business: TiersEnum.Custom,
};

const PLAN_PRICES: Record<PlanKey, string> = {
  free: "$0/month",
  starter: "$40/month",
  growth: "$90/month",
  business: "$160/month",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trial: "Trial",
  cancelled: "Cancelled",
  suspended: "Suspended",
};

export default function PlanOverview() {
  const userBilling = useQuery(api.core.users.getUserBilling);
  const userUsage = useQuery(api.core.users.getUserUsage);

  const currentPlanKey = (userBilling?.plan ?? "free") as PlanKey;
  const planLabel = PLAN_KEY_TO_LABEL[currentPlanKey];
  const planPrice = PLAN_PRICES[currentPlanKey];

  const currentTier = useMemo(
    () =>
      tiers.find((tier) => tier.key === PLAN_KEY_TO_TIER[currentPlanKey]) ?? null,
    [currentPlanKey],
  );

  if (userBilling === undefined || userUsage === undefined) {
    return <PlanOverviewSkeleton />;
  }

  const statusLabel = userBilling?.status
    ? STATUS_LABELS[userBilling.status] ?? userBilling.status
    : STATUS_LABELS.active;

  const ordersLast30Days = userUsage?.ordersLast30Days ?? 0;
  const orderLimit = userUsage?.orderLimit ?? 300;
  const usagePercentage = orderLimit > 0 ? (ordersLast30Days / orderLimit) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-default-800">
            Current Plan
          </h3>
          <Chip
            color={currentPlanKey === "free" ? "default" : "primary"}
            size="sm"
            startContent={
              currentPlanKey === "free" ? null : (
                <Icon icon="solar:crown-star-bold-duotone" width={14} />
              )
            }
            variant="flat"
          >
            {currentTier?.title ?? planLabel.replace(" Plan", "")}
          </Chip>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-default-800">{planPrice}</p>
          <p className="text-xs text-default-500">Status: {statusLabel}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-default-700">Plan Usage (Last 30 Days)</p>
          <p className="text-sm text-default-600">
            {ordersLast30Days.toLocaleString()} / {orderLimit.toLocaleString()} orders
          </p>
        </div>
        <Progress
          value={usagePercentage}
          color={usagePercentage >= 90 ? "danger" : usagePercentage >= 75 ? "warning" : "primary"}
          className="w-full"
          size="sm"
        />
        <p className="text-xs text-default-500">
          Track up to {orderLimit.toLocaleString()} orders per month with your {currentTier?.title || planLabel.replace(" Plan", "")} plan
        </p>
      </div>
    </div>
  );
}
