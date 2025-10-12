import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { action, query, type ActionCtx, type QueryCtx } from "../_generated/server";
import { api } from "../_generated/api";
import {
  dateRangeValidator,
  defaultDateRange,
  loadAnalytics,
  type AnalyticsResponse,
} from "./analyticsShared";
import {
  filterAccountLevelMetaInsights,
  percentageChange,
  safeNumber,
  type AnyRecord,
} from "../utils/analytics/shared";
import { type AnalyticsSourceKey, type DateRange } from "../utils/analyticsSource";
import { computeOverviewMetrics, computePlatformMetrics, computeChannelRevenue } from "../utils/analyticsAggregations";
import type {
  OverviewComputation,
  ChannelRevenueBreakdown,
  PlatformMetrics,
  MetricValue,
  OnboardingStatus,
} from "@repo/types";
import { DEFAULT_DASHBOARD_CONFIG } from "@repo/types";
import { onboardingStatusValidator } from "../utils/onboardingValidators";
import { getUserAndOrg } from "../utils/auth";
import { resolveDashboardConfig } from "../utils/dashboardConfig";
import { computeIntegrationStatus, integrationStatusValidator } from "../utils/integrationStatus";
import { loadAnalyticsWithChunks } from "../utils/analyticsLoader";
import { loadOverviewFromDailyMetrics } from "../utils/dailyMetrics";
import { resolveDateRangeForOrganization } from "../utils/orgDateRange";

type IntegrationStatus = Awaited<ReturnType<typeof computeIntegrationStatus>>;
type OverviewPayload = {
  dateRange: DateRange;
  organizationId: string;
  overview: OverviewComputation | null;
  platformMetrics: PlatformMetrics | null | undefined;
  channelRevenue: ChannelRevenueBreakdown | null | undefined;
  primaryCurrency?: string;
  dashboardConfig: { kpis: string[]; widgets: string[] };
  integrationStatus: IntegrationStatus;
  onboardingStatus: OnboardingStatus | null;
  meta?: Record<string, unknown> | undefined;
};

type OverviewArgs = {
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: DateRange;
};

const DASHBOARD_SUMMARY_DATASETS = [
  "orders",
  "orderItems",
  "transactions",
  "refunds",
  "variants",
  "variantCosts",
  "customers",
  "globalCosts",
  "manualReturnRates",
  "metaInsights",
  "analytics",
] as const satisfies readonly AnalyticsSourceKey[];

function mergePlatformMetrics(
  base: PlatformMetrics | null | undefined,
  supplemental: PlatformMetrics | null | undefined,
): PlatformMetrics | null {
  if (!base && !supplemental) {
    return null;
  }

  return {
    ...(base ?? {}),
    ...(supplemental ?? {}),
  } as PlatformMetrics;
}

function computeMetaSpend(response: AnalyticsResponse | null | undefined): number {
  if (!response?.data) {
    return 0;
  }

  const metaInsights = filterAccountLevelMetaInsights(
    (response.data.metaInsights ?? []) as AnyRecord[],
  );
  if (!metaInsights.length) {
    return 0;
  }

  return metaInsights.reduce((total, insight) => {
    const spend = safeNumber((insight?.spend ?? insight?.amount ?? insight?.cost) as number | string | undefined);
    return total + spend;
  }, 0);
}

function cloneOverview(overview: OverviewComputation | null): OverviewComputation | null {
  if (!overview) return null;

  return {
    summary: { ...overview.summary },
    metrics: { ...(overview.metrics ?? {}) },
    extras: { ...(overview.extras ?? {}) },
  } satisfies OverviewComputation;
}

function resolvePreviousMetricValue(metric: MetricValue | null | undefined): number {
  if (!metric) {
    return 0;
  }

  const { value, change, previousValue } = metric;
  if (typeof previousValue === 'number' && Number.isFinite(previousValue)) {
    return previousValue;
  }
  if (!Number.isFinite(value) || !Number.isFinite(change)) {
    return 0;
  }

  if (change === 0) {
    return value;
  }

  const ratio = change / 100;
  const computeCandidate = (denominator: number): number | null => {
    if (denominator === 0) {
      return null;
    }

    const candidate = value / denominator;
    if (!Number.isFinite(candidate)) {
      return null;
    }

    const recomputed = percentageChange(value, candidate);
    if (!Number.isFinite(recomputed)) {
      return null;
    }

    return Math.abs(recomputed - change) <= 0.000001 ? candidate : null;
  };

  // Attempt to reconstruct assuming previous value shared the current sign.
  const positiveAssumption = computeCandidate(1 + ratio);
  if (positiveAssumption !== null) {
    return positiveAssumption;
  }

  // Fall back to the opposite sign (covers negative baselines).
  const negativeAssumption = computeCandidate(1 - ratio);
  if (negativeAssumption !== null) {
    return negativeAssumption;
  }

  if (value === 0 && Math.abs(change) === 100) {
    return change > 0 ? -1 : 1;
  }

  return 0;
}

function extractMetaRevenue(
  channelRevenue: ChannelRevenueBreakdown | null | undefined,
): number {
  if (!channelRevenue?.channels?.length) {
    return 0;
  }

  const metaChannel = channelRevenue.channels.find((channel) => {
    const name = channel.name?.toLowerCase?.() ?? "";
    return name === "meta ads" || name === "meta";
  });

  return metaChannel?.revenue ?? 0;
}

function applyUtmRoasMetric(
  overview: OverviewComputation | null,
  channelRevenue: ChannelRevenueBreakdown | null | undefined,
): void {
  if (!overview?.summary) {
    return;
  }

  const metaRevenue = extractMetaRevenue(channelRevenue);
  const metaAdSpend = overview.summary.metaAdSpend ?? 0;

  if (!Number.isFinite(metaRevenue) || !Number.isFinite(metaAdSpend)) {
    return;
  }

  const value = metaAdSpend > 0 ? metaRevenue / metaAdSpend : 0;
  const existingChange = Number.isFinite(overview.summary.metaROASChange)
    ? overview.summary.metaROASChange
    : 0;

  overview.summary.metaROAS = value;
  overview.summary.metaROASChange = existingChange ?? 0;

  const previousMetaRoasValue = resolvePreviousMetricValue(overview.metrics?.metaROAS);
  const metric: MetricValue = {
    value,
    change: Number.isFinite(existingChange) ? existingChange : 0,
    previousValue: previousMetaRoasValue,
  } satisfies MetricValue;

  overview.metrics = overview.metrics ?? {};
  overview.metrics.metaROAS = metric;
  overview.metrics.roasUTM = { ...metric } satisfies MetricValue;
}

function applyMetaSpendMetrics(
  overview: OverviewComputation | null,
  metaAdSpendInput: number,
  totalAdSpendInput: number,
): void {
  if (!overview?.summary) {
    return;
  }

  const summary = overview.summary;
  const metrics = overview.metrics ?? {};
  const previousSummary = {
    blendedMarketingCost: summary.blendedMarketingCost,
    blendedMarketingCostChange: summary.blendedMarketingCostChange,
    metaAdSpend: summary.metaAdSpend,
    metaAdSpendChange: summary.metaAdSpendChange,
    metaSpendPercentage: summary.metaSpendPercentage,
    metaSpendPercentageChange: summary.metaSpendPercentageChange,
    roas: summary.roas,
    roasChange: summary.roasChange,
    metaROAS: summary.metaROAS,
    metaROASChange: summary.metaROASChange,
    customerAcquisitionCost: summary.customerAcquisitionCost,
    customerAcquisitionCostChange: summary.customerAcquisitionCostChange,
    cacPercentageOfAOV: summary.cacPercentageOfAOV,
    cacPercentageOfAOVChange: summary.cacPercentageOfAOVChange,
    adSpendPerOrder: summary.adSpendPerOrder,
    adSpendPerOrderChange: summary.adSpendPerOrderChange,
    marketingPercentageOfGross: summary.marketingPercentageOfGross,
    marketingPercentageOfGrossChange: summary.marketingPercentageOfGrossChange,
    marketingPercentageOfNet: summary.marketingPercentageOfNet,
    marketingPercentageOfNetChange: summary.marketingPercentageOfNetChange,
    profit: summary.profit,
    profitChange: summary.profitChange,
    profitMargin: summary.profitMargin,
    profitMarginChange: summary.profitMarginChange,
    poas: summary.poas,
    poasChange: summary.poasChange,
    profitPerOrder: summary.profitPerOrder,
    profitPerOrderChange: summary.profitPerOrderChange,
    avgOrderProfit: summary.avgOrderProfit ?? summary.profitPerOrder,
    avgOrderProfitChange: summary.avgOrderProfitChange,
  };
  const toMetricValue = (
    value: number | null | undefined,
    change: number | null | undefined,
  ): MetricValue | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    if (typeof change !== 'number' || !Number.isFinite(change)) {
      return null;
    }
    return { value, change } satisfies MetricValue;
  };
  const resolvePrevious = (
    metric: MetricValue | null | undefined,
    value: number | null | undefined,
    change: number | null | undefined,
  ): number => resolvePreviousMetricValue(metric ?? toMetricValue(value, change));

  const resolvedTotalAdSpend = totalAdSpendInput > 0 ? totalAdSpendInput : metaAdSpendInput;
  const resolvedMetaAdSpend = metaAdSpendInput > 0 ? metaAdSpendInput : 0;

  if (resolvedTotalAdSpend <= 0) {
    return;
  }

  const previousBlendedMarketingCost = resolvePrevious(
    metrics.blendedMarketingCost,
    previousSummary.blendedMarketingCost ?? null,
    previousSummary.blendedMarketingCostChange ?? null,
  );
  const blendedMarketingCostChange = percentageChange(resolvedTotalAdSpend, previousBlendedMarketingCost);
  summary.blendedMarketingCost = resolvedTotalAdSpend;
  summary.blendedMarketingCostChange = blendedMarketingCostChange;

  const previousMetaAdSpend = resolvePrevious(
    metrics.metaAdSpend,
    previousSummary.metaAdSpend ?? null,
    previousSummary.metaAdSpendChange ?? null,
  );
  const metaAdSpendChange = percentageChange(resolvedMetaAdSpend, previousMetaAdSpend);
  summary.metaAdSpend = resolvedMetaAdSpend;
  summary.metaAdSpendChange = metaAdSpendChange;

  const metaSpendPercentage = resolvedTotalAdSpend > 0
    ? (resolvedMetaAdSpend / resolvedTotalAdSpend) * 100
    : resolvedMetaAdSpend > 0
      ? 100
      : 0;
  summary.metaSpendPercentage = metaSpendPercentage;
  const previousMetaSpendPercentage = resolvePrevious(
    metrics.metaSpendPercentage,
    previousSummary.metaSpendPercentage ?? null,
    previousSummary.metaSpendPercentageChange ?? null,
  );
  const metaSpendPercentageChange = percentageChange(metaSpendPercentage, previousMetaSpendPercentage);
  summary.metaSpendPercentageChange = metaSpendPercentageChange;

  const revenue = summary.revenue ?? 0;
  const orders = summary.orders ?? 0;
  const avgOrderValue = summary.avgOrderValue ?? 0;

  const blendedRoas = resolvedTotalAdSpend > 0 ? revenue / resolvedTotalAdSpend : 0;
  const metaRoas = resolvedMetaAdSpend > 0 ? revenue / resolvedMetaAdSpend : 0;
  summary.roas = blendedRoas;
  summary.metaROAS = metaRoas;
  const previousRoas = resolvePrevious(
    metrics.roas,
    previousSummary.roas ?? null,
    previousSummary.roasChange ?? null,
  );
  const previousMetaRoas = resolvePrevious(
    metrics.metaROAS,
    previousSummary.metaROAS ?? null,
    previousSummary.metaROASChange ?? null,
  );
  const roasChange = percentageChange(blendedRoas, previousRoas);
  const metaRoasChange = percentageChange(metaRoas, previousMetaRoas);
  summary.roasChange = roasChange;
  summary.metaROASChange = metaRoasChange;

  const customerAcquisitionCost = orders > 0 ? resolvedTotalAdSpend / orders : 0;
  summary.customerAcquisitionCost = customerAcquisitionCost;
  const previousCustomerAcquisitionCost = resolvePrevious(
    metrics.customerAcquisitionCost,
    previousSummary.customerAcquisitionCost ?? null,
    previousSummary.customerAcquisitionCostChange ?? null,
  );
  const customerAcquisitionCostChange = percentageChange(customerAcquisitionCost, previousCustomerAcquisitionCost);
  summary.customerAcquisitionCostChange = customerAcquisitionCostChange;

  const customerCount = summary.customers ?? 0;
  const lifetimeValue = customerCount > 0 ? revenue / customerCount : 0;
  const previousLtvToCac = resolvePreviousMetricValue(metrics.ltvToCACRatio);
  const ltvToCacRatio = customerAcquisitionCost > 0 ? lifetimeValue / customerAcquisitionCost : 0;
  const ltvToCacRatioChange = percentageChange(ltvToCacRatio, previousLtvToCac);

  const cacPercentageOfAOV = avgOrderValue > 0
    ? (customerAcquisitionCost / avgOrderValue) * 100
    : 0;
  summary.cacPercentageOfAOV = cacPercentageOfAOV;
  const previousCacPercentageOfAOV = resolvePrevious(
    metrics.cacPercentageOfAOV,
    previousSummary.cacPercentageOfAOV ?? null,
    previousSummary.cacPercentageOfAOVChange ?? null,
  );
  const cacPercentageOfAOVChange = percentageChange(cacPercentageOfAOV, previousCacPercentageOfAOV);
  summary.cacPercentageOfAOVChange = cacPercentageOfAOVChange;

  const adSpendPerOrder = orders > 0 ? resolvedTotalAdSpend / orders : 0;
  summary.adSpendPerOrder = adSpendPerOrder;
  const previousAdSpendPerOrder = resolvePrevious(
    metrics.adSpendPerOrder,
    previousSummary.adSpendPerOrder ?? null,
    previousSummary.adSpendPerOrderChange ?? null,
  );
  const adSpendPerOrderChange = percentageChange(adSpendPerOrder, previousAdSpendPerOrder);
  summary.adSpendPerOrderChange = adSpendPerOrderChange;

  const grossSales = summary.grossSales ?? revenue;
  const marketingPercentageOfGross = grossSales > 0 ? (resolvedTotalAdSpend / grossSales) * 100 : 0;
  const marketingPercentageOfNet = revenue > 0 ? (resolvedTotalAdSpend / revenue) * 100 : 0;
  const previousMarketingPercentageOfGross = resolvePrevious(
    metrics.marketingPercentageOfGross,
    previousSummary.marketingPercentageOfGross ?? null,
    previousSummary.marketingPercentageOfGrossChange ?? null,
  );
  const previousMarketingPercentageOfNet = resolvePrevious(
    metrics.marketingPercentageOfNet,
    previousSummary.marketingPercentageOfNet ?? null,
    previousSummary.marketingPercentageOfNetChange ?? null,
  );
  const marketingPercentageOfGrossChange = percentageChange(
    marketingPercentageOfGross,
    previousMarketingPercentageOfGross,
  );
  const marketingPercentageOfNetChange = percentageChange(
    marketingPercentageOfNet,
    previousMarketingPercentageOfNet,
  );
  summary.marketingPercentageOfGross = marketingPercentageOfGross;
  summary.marketingPercentageOfNet = marketingPercentageOfNet;
  summary.marketingPercentageOfGrossChange = marketingPercentageOfGrossChange;
  summary.marketingPercentageOfNetChange = marketingPercentageOfNetChange;

  const cogs = summary.cogs ?? 0;
  const shippingCosts = summary.shippingCosts ?? 0;
  const transactionFees = summary.transactionFees ?? 0;
  const handlingFees = summary.handlingFees ?? 0;
  const taxesCollected = summary.taxesCollected ?? 0;
  const customCosts = summary.customCosts ?? 0;
  const refunds = summary.refunds ?? 0;
  const rtoRevenueLost = summary.rtoRevenueLost ?? 0;

  const totalCostsWithoutAds = cogs + shippingCosts + transactionFees + handlingFees + taxesCollected + customCosts;
  const totalReturnImpact = refunds + rtoRevenueLost;
  const netProfit = revenue - totalCostsWithoutAds - resolvedTotalAdSpend - totalReturnImpact;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  summary.profit = netProfit;
  summary.profitMargin = profitMargin;
  const previousProfit = resolvePrevious(
    metrics.profit,
    previousSummary.profit ?? null,
    previousSummary.profitChange ?? null,
  );
  const previousProfitMargin = resolvePrevious(
    metrics.profitMargin,
    previousSummary.profitMargin ?? null,
    previousSummary.profitMarginChange ?? null,
  );
  const profitChange = percentageChange(netProfit, previousProfit);
  const profitMarginChange = percentageChange(profitMargin, previousProfitMargin);
  summary.profitChange = profitChange;
  summary.profitMarginChange = profitMarginChange;

  const poas = resolvedTotalAdSpend > 0 ? netProfit / resolvedTotalAdSpend : 0;
  summary.poas = poas;
  const previousPoas = resolvePrevious(
    metrics.poas,
    previousSummary.poas ?? null,
    previousSummary.poasChange ?? null,
  );
  const poasChange = percentageChange(poas, previousPoas);
  summary.poasChange = poasChange;

  const profitPerOrder = orders > 0 ? netProfit / orders : 0;
  summary.profitPerOrder = profitPerOrder;
  summary.avgOrderProfit = profitPerOrder;
  const previousProfitPerOrder = resolvePrevious(
    metrics.profitPerOrder,
    previousSummary.profitPerOrder ?? null,
    previousSummary.profitPerOrderChange ?? null,
  );
  const previousAvgOrderProfit = resolvePrevious(
    metrics.avgOrderProfit,
    previousSummary.avgOrderProfit ?? null,
    previousSummary.avgOrderProfitChange ?? null,
  );
  const profitPerOrderChange = percentageChange(profitPerOrder, previousProfitPerOrder);
  const avgOrderProfitChange = percentageChange(profitPerOrder, previousAvgOrderProfit);
  summary.profitPerOrderChange = profitPerOrderChange;
  summary.avgOrderProfitChange = avgOrderProfitChange;

  overview.metrics = metrics;
  overview.metrics.metaAdSpend = {
    value: resolvedMetaAdSpend,
    change: metaAdSpendChange,
    previousValue: previousMetaAdSpend,
  } satisfies MetricValue;
  overview.metrics.metaSpendPercentage = {
    value: metaSpendPercentage,
    change: metaSpendPercentageChange,
    previousValue: previousMetaSpendPercentage,
  } satisfies MetricValue;
  overview.metrics.blendedMarketingCost = {
    value: resolvedTotalAdSpend,
    change: blendedMarketingCostChange,
    previousValue: previousBlendedMarketingCost,
  } satisfies MetricValue;
  overview.metrics.roas = {
    value: blendedRoas,
    change: roasChange,
    previousValue: previousRoas,
  } satisfies MetricValue;
  overview.metrics.metaROAS = {
    value: metaRoas,
    change: metaRoasChange,
    previousValue: previousMetaRoas,
  } satisfies MetricValue;
  overview.metrics.customerAcquisitionCost = {
    value: customerAcquisitionCost,
    change: customerAcquisitionCostChange,
    previousValue: previousCustomerAcquisitionCost,
  } satisfies MetricValue;
  overview.metrics.ltvToCACRatio = {
    value: ltvToCacRatio,
    change: ltvToCacRatioChange,
    previousValue: previousLtvToCac,
  } satisfies MetricValue;
  overview.metrics.cacPercentageOfAOV = {
    value: cacPercentageOfAOV,
    change: cacPercentageOfAOVChange,
    previousValue: previousCacPercentageOfAOV,
  } satisfies MetricValue;
  overview.metrics.adSpendPerOrder = {
    value: adSpendPerOrder,
    change: adSpendPerOrderChange,
    previousValue: previousAdSpendPerOrder,
  } satisfies MetricValue;
  overview.metrics.marketingPercentageOfGross = {
    value: marketingPercentageOfGross,
    change: marketingPercentageOfGrossChange,
    previousValue: previousMarketingPercentageOfGross,
  } satisfies MetricValue;
  overview.metrics.marketingPercentageOfNet = {
    value: marketingPercentageOfNet,
    change: marketingPercentageOfNetChange,
    previousValue: previousMarketingPercentageOfNet,
  } satisfies MetricValue;
  overview.metrics.profit = {
    value: netProfit,
    change: profitChange,
    previousValue: previousProfit,
  } satisfies MetricValue;
  overview.metrics.profitMargin = {
    value: profitMargin,
    change: profitMarginChange,
    previousValue: previousProfitMargin,
  } satisfies MetricValue;
  overview.metrics.poas = {
    value: poas,
    change: poasChange,
    previousValue: previousPoas,
  } satisfies MetricValue;
  overview.metrics.profitPerOrder = {
    value: profitPerOrder,
    change: profitPerOrderChange,
    previousValue: previousProfitPerOrder,
  } satisfies MetricValue;
  overview.metrics.avgOrderProfit = {
    value: profitPerOrder,
    change: avgOrderProfitChange,
    previousValue: previousAvgOrderProfit,
  } satisfies MetricValue;
}


const DAY_MS = 24 * 60 * 60 * 1000;

function isTooManyReadsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Too many reads");
}

function shiftDateString(date: string, deltaDays: number): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    return date;
  }
  const shifted = new Date(parsed);
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
  return shifted.toISOString().slice(0, 10);
}

function derivePreviousRange(range: DateRange): DateRange | null {
  const startMs = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const endMs = Date.parse(`${range.endDate}T23:59:59.999Z`) + 1;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }

  const spanDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));

  return {
    startDate: shiftDateString(range.startDate, -spanDays),
    endDate: shiftDateString(range.startDate, -1),
  } satisfies DateRange;
}

export const getOverviewData = query({
  args: {
    timeRange: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
      organizationId: v.string(),
      overview: v.optional(v.any()),
      platformMetrics: v.optional(v.any()),
      channelRevenue: v.optional(v.any()),
      primaryCurrency: v.optional(v.string()),
      dashboardConfig: v.object({
        kpis: v.array(v.string()),
        widgets: v.array(v.string()),
      }),
      integrationStatus: integrationStatusValidator,
      onboardingStatus: onboardingStatusValidator,
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx: QueryCtx, args: OverviewArgs): Promise<OverviewPayload | null> => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const orgId = auth.orgId as Id<"organizations">;

    const rangeInput =
      args.dateRange ??
      (args.startDate && args.endDate
        ? { startDate: args.startDate, endDate: args.endDate }
        : defaultDateRange(parseTimeRange(args.timeRange)));

    const range = await resolveDateRangeForOrganization(
      ctx,
      orgId,
      rangeInput,
    );

    const dashboardConfig = await resolveDashboardConfig(
      ctx,
      auth.user._id,
      auth.orgId,
    );
    const userRole = auth.membership?.role ?? null;
    const canViewDevTools = userRole === "StoreOwner";
    // Read cached status via query to avoid recomputation and large reads
    const integrationStatus = await ctx.runQuery(api.core.status.getIntegrationStatus, {});
    const onboardingStatus = await ctx.runQuery(api.core.onboarding.getOnboardingStatus, {});
    const orgDoc = await ctx.db.get(orgId);
    const primaryCurrency = orgDoc?.primaryCurrency ?? "USD";

    // ONLY read from dailyMetrics (aggregated data) - no raw order reads
    const dailyOverview = await loadOverviewFromDailyMetrics(
      ctx,
      orgId,
      range,
    );

    if (!dailyOverview) {
      // Metrics not yet calculated - return calculating state
      return {
        dateRange: range,
        organizationId: auth.orgId,
        overview: null,
        platformMetrics: null,
        channelRevenue: null,
        primaryCurrency,
        dashboardConfig,
        integrationStatus,
        onboardingStatus,
        meta: {
          strategy: "dailyMetrics",
          status: "calculating",
          message: "Metrics are being calculated. This usually takes 10-30 seconds after sync completion.",
          userRole,
          canViewDevTools,
        },
      } satisfies OverviewPayload;
    }

    const overview = cloneOverview(dailyOverview.overview);
    const meta: Record<string, unknown> = {
      ...(dailyOverview.meta ?? {}),
      strategy: "dailyMetrics",
      userRole,
      canViewDevTools,
    };

    // Metrics available from dailyMetrics table
    const basePayload: OverviewPayload = {
      dateRange: range,
      organizationId: auth.orgId,
      overview,
      platformMetrics: dailyOverview.platformMetrics,
      channelRevenue: null,
      primaryCurrency,
      dashboardConfig,
      integrationStatus,
      onboardingStatus,
      meta,
    } satisfies OverviewPayload;

    // Try to load minimal supplemental data for channel revenue
    // Using small dataset to avoid large reads
    const supplementalDatasets = ["orders", "analytics", "metaInsights"] as const;
    try {
      const analyticsResponse = await loadAnalytics(ctx, orgId, range, {
        datasets: supplementalDatasets,
      });

      const channelRevenue = computeChannelRevenue(analyticsResponse);
      applyUtmRoasMetric(overview, channelRevenue);
      const metaAdSpendFromInsights = computeMetaSpend(analyticsResponse);
      const existingTotalAdSpend = overview?.summary?.blendedMarketingCost ?? 0;
      const fallbackMetaAdSpend = overview?.summary?.metaAdSpend ?? existingTotalAdSpend;
      const resolvedMetaAdSpend = metaAdSpendFromInsights > 0 ? metaAdSpendFromInsights : fallbackMetaAdSpend;
      if (overview?.summary && (resolvedMetaAdSpend > 0 || existingTotalAdSpend > 0)) {
        applyMetaSpendMetrics(overview, resolvedMetaAdSpend, existingTotalAdSpend);
      }
      const supplementalPlatformMetrics = computePlatformMetrics(analyticsResponse);
      const mergedPlatformMetrics = mergePlatformMetrics(
        dailyOverview.platformMetrics,
        supplementalPlatformMetrics,
      );

      return {
        ...basePayload,
        channelRevenue,
        platformMetrics: mergedPlatformMetrics ?? dailyOverview.platformMetrics,
        meta: {
          ...meta,
          supplemental: {
            datasets: supplementalDatasets,
          },
        },
      } satisfies OverviewPayload;
    } catch (error) {
      // If supplemental load fails, return base metrics without channel revenue
      console.warn("[DASHBOARD] Failed to load supplemental channel revenue data", error);
      return basePayload;
    }
  },
});

const getOverviewDataActionDefinition = {
  args: {
    timeRange: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
      organizationId: v.string(),
      overview: v.optional(v.any()),
      platformMetrics: v.optional(v.any()),
      channelRevenue: v.optional(v.any()),
      primaryCurrency: v.optional(v.string()),
      dashboardConfig: v.object({
        kpis: v.array(v.string()),
        widgets: v.array(v.string()),
      }),
      integrationStatus: integrationStatusValidator,
      onboardingStatus: onboardingStatusValidator,
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx: ActionCtx, args: OverviewArgs): Promise<OverviewPayload | null> => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const userRole = auth.membership?.role ?? null;
    const canViewDevTools = userRole === "StoreOwner";

    const orgId = auth.orgId as Id<"organizations">;
    const rangeInput =
      args.dateRange ??
      (args.startDate && args.endDate
        ? { startDate: args.startDate, endDate: args.endDate }
        : defaultDateRange(parseTimeRange(args.timeRange)));

    const range = await resolveDateRangeForOrganization(ctx, orgId, rangeInput);

    const { data, meta } = await loadAnalyticsWithChunks(
      ctx,
      orgId,
      range,
      {
        datasets: DASHBOARD_SUMMARY_DATASETS,
      },
    );

    const analyticsResponse: AnalyticsResponse = {
      dateRange: range,
      organizationId: auth.orgId,
      data,
      ...(meta ? { meta } : {}),
    };

    const previousRange = derivePreviousRange(range);
    let previousAnalyticsResponse: AnalyticsResponse | null = null;

    if (previousRange) {
      try {
        const resolvedPreviousRange = await resolveDateRangeForOrganization(
          ctx,
          orgId,
          previousRange,
        );

        const { data: previousData, meta: previousMeta } = await loadAnalyticsWithChunks(
          ctx,
          orgId,
          resolvedPreviousRange,
          {
            datasets: DASHBOARD_SUMMARY_DATASETS,
          },
        );

        previousAnalyticsResponse = {
          dateRange: resolvedPreviousRange,
          organizationId: auth.orgId,
          data: previousData,
          ...(previousMeta ? { meta: previousMeta } : {}),
        };
      } catch (error) {
        if (!isTooManyReadsError(error)) {
          console.error("Failed to load previous analytics via action:", error);
        }
      }
    }

    const dashboardLayout = await ctx.runQuery(api.core.dashboard.getDashboardLayout, {});
    const integrationStatus = await ctx.runQuery(api.core.status.getIntegrationStatus, {});
    const onboardingStatus = await ctx.runQuery(api.core.onboarding.getOnboardingStatus, {});

    const overview = computeOverviewMetrics(analyticsResponse, previousAnalyticsResponse);
    const platformMetrics = computePlatformMetrics(analyticsResponse);
    const channelRevenue = computeChannelRevenue(analyticsResponse);
    applyUtmRoasMetric(overview, channelRevenue);

    const primaryCurrency =
      (await ctx.runQuery(api.core.currency.getPrimaryCurrencyForOrg, {
        orgId,
      })) ?? "USD";

    const metaPayload: Record<string, unknown> = {
      ...(analyticsResponse.meta ?? {}),
      ...(previousRange ? { previousRange } : {}),
      userRole,
      canViewDevTools,
    };

    return {
      dateRange: analyticsResponse.dateRange,
      organizationId: analyticsResponse.organizationId,
      overview,
      platformMetrics,
      channelRevenue,
      primaryCurrency,
      dashboardConfig: dashboardLayout ?? DEFAULT_DASHBOARD_CONFIG,
      integrationStatus,
      onboardingStatus,
      meta: metaPayload,
    } satisfies OverviewPayload;
  },
};

export const getOverviewDataAction = action(getOverviewDataActionDefinition);

function parseTimeRange(timeRange?: string | null): number {
  switch (timeRange) {
    case "today":
      return 1;
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "30d":
    default:
      return 30;
  }
}
