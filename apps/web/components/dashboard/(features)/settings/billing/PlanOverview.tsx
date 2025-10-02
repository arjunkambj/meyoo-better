"use client";

import { useMemo } from "react";

import { Chip } from "@heroui/react";
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

  const currentPlanKey = (userBilling?.plan ?? "free") as PlanKey;
  const planLabel = PLAN_KEY_TO_LABEL[currentPlanKey];
  const planPrice = PLAN_PRICES[currentPlanKey];

  const currentTier = useMemo(
    () =>
      tiers.find((tier) => tier.key === PLAN_KEY_TO_TIER[currentPlanKey]) ?? null,
    [currentPlanKey],
  );

  if (userBilling === undefined) {
    return <PlanOverviewSkeleton />;
  }

  const statusLabel = userBilling?.status
    ? STATUS_LABELS[userBilling.status] ?? userBilling.status
    : STATUS_LABELS.active;

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
                <Icon icon="solar:crown-star-bold" width={14} />
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

      <div className="rounded-lg border border-default-100 bg-content1/40 px-3 py-3">
        <p className="text-xs text-default-600">
          Plan changes are managed through your Shopify subscription. Visit
          <span className="font-medium text-default-800">
            {" "}Settings → Billing
          </span>{" "}
          to switch plans or manage invoices.
        </p>
      </div>
    </div>
  );
}
