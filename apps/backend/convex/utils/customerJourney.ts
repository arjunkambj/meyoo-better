import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { loadCustomerOverviewFromDailyMetrics } from "./dailyMetrics";
import type { DateRange } from "./analyticsSource";
import type { OrdersJourneyStage } from "@repo/types";

const META_INSIGHTS_PAGE_SIZE = 250;

export const DEFAULT_JOURNEY_STAGES: OrdersJourneyStage[] = [
  {
    stage: "Awareness",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:eye-bold-duotone",
    color: "primary",
  },
  {
    stage: "Interest",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:heart-bold-duotone",
    color: "interest",
  },
  {
    stage: "Consideration",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:cart-bold-duotone",
    color: "warning",
  },
  {
    stage: "Purchase",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:bag-bold-duotone",
    color: "success",
  },
  {
    stage: "Retention",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:refresh-circle-bold-duotone",
    color: "retention",
  },
] as const;

type MetaTotals = {
  impressions: number;
  clicks: number;
  conversions: number;
};

const INITIAL_META_TOTALS: MetaTotals = {
  impressions: 0,
  clicks: 0,
  conversions: 0,
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.min(100, Math.max(0, value));
  return Number.parseFloat(clamped.toFixed(2));
};

const baseForPercentage = (values: number[]): number => {
  for (const value of values) {
    if (value > 0) {
      return value;
    }
  }
  return 1;
};

export async function loadCustomerJourneyStages(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
): Promise<OrdersJourneyStage[]> {
  const dailyOverview = await loadCustomerOverviewFromDailyMetrics(
    ctx,
    organizationId,
    range,
  );

  if (!dailyOverview?.metrics) {
    return [...DEFAULT_JOURNEY_STAGES];
  }

  const metrics = dailyOverview.metrics;
  const returningCustomers = metrics.returningCustomers || 0;

  let metaTotals = { ...INITIAL_META_TOTALS };
  let cursor: string | null = null;

  while (true) {
    const page = await ctx.db
      .query("metaInsights")
      .withIndex("by_org_date", (q) =>
        q
          .eq("organizationId", organizationId)
          .gte("date", range.startDate)
          .lte("date", range.endDate),
      )
      .paginate({ numItems: META_INSIGHTS_PAGE_SIZE, cursor });

    for (const insight of page.page) {
      if ((insight as any).entityType !== "account") continue;

      const impressions =
        typeof (insight as any).impressions === "number"
          ? (insight as any).impressions
          : 0;
      const clicks =
        typeof (insight as any).clicks === "number"
          ? (insight as any).clicks
          : 0;
      const conversions =
        typeof (insight as any).conversions === "number"
          ? (insight as any).conversions
          : 0;

      metaTotals = {
        impressions: metaTotals.impressions + Math.max(impressions, 0),
        clicks: metaTotals.clicks + Math.max(clicks, 0),
        conversions: metaTotals.conversions + Math.max(conversions, 0),
      };
    }

    if (page.isDone || !page.continueCursor) {
      break;
    }
    cursor = page.continueCursor;
  }

  const awarenessCustomers = Math.max(metaTotals.impressions, 0);
  const interestCustomers = Math.max(metaTotals.clicks, 0);
  const considerationCustomers = Math.max(
    (metrics.abandonedCartCustomers || 0) +
      (metrics.periodCustomerCount || 0),
    0,
  );
  const purchaseCustomers = Math.max(metrics.periodCustomerCount || 0, 0);
  const retentionCustomers = Math.max(returningCustomers, 0);

  const metaConversionRate =
    interestCustomers > 0
      ? clampPercent((metaTotals.conversions / interestCustomers) * 100)
      : 0;

  const base = baseForPercentage([
    awarenessCustomers,
    interestCustomers,
    considerationCustomers,
    purchaseCustomers,
    retentionCustomers,
  ]);

  const toPercentage = (value: number) =>
    clampPercent(base > 0 ? (value / base) * 100 : 0);

  const awarenessToInterest =
    awarenessCustomers > 0
      ? clampPercent((interestCustomers / awarenessCustomers) * 100)
      : 0;
  const interestToConsideration =
    interestCustomers > 0
      ? clampPercent((considerationCustomers / interestCustomers) * 100)
      : 0;
  const considerationToPurchase =
    considerationCustomers > 0
      ? clampPercent((purchaseCustomers / considerationCustomers) * 100)
      : 0;
  const purchaseToRetention =
    purchaseCustomers > 0
      ? clampPercent((retentionCustomers / purchaseCustomers) * 100)
      : 0;

  return [
    {
      stage: "Awareness",
      customers: awarenessCustomers,
      percentage:
        awarenessCustomers > 0
          ? 100
          : toPercentage(awarenessCustomers),
      avgDays: 0,
      conversionRate: awarenessToInterest,
      icon: "solar:eye-bold-duotone",
      color: "primary",
    },
    {
      stage: "Interest",
      customers: interestCustomers,
      percentage: toPercentage(interestCustomers),
      avgDays: 0,
      conversionRate: interestToConsideration,
      icon: "solar:heart-bold-duotone",
      color: "interest",
      metaConversionRate,
    },
    {
      stage: "Consideration",
      customers: considerationCustomers,
      percentage: toPercentage(considerationCustomers),
      avgDays: 0,
      conversionRate: considerationToPurchase,
      icon: "solar:cart-bold-duotone",
      color: "warning",
    },
    {
      stage: "Purchase",
      customers: purchaseCustomers,
      percentage: toPercentage(purchaseCustomers),
      avgDays: 0,
      conversionRate: purchaseToRetention,
      icon: "solar:bag-bold-duotone",
      color: "success",
    },
    {
      stage: "Retention",
      customers: retentionCustomers,
      percentage: toPercentage(retentionCustomers),
      avgDays: 0,
      conversionRate: 0,
      icon: "solar:refresh-circle-bold-duotone",
      color: "retention",
    },
  ];
}
