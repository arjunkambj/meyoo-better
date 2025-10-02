import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { validateDateRange, type AnalyticsSourceKey } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { computeChannelRevenue, computePlatformMetrics } from "../utils/analyticsAggregations";
import type { ChannelRevenueBreakdown, PlatformMetrics } from "@repo/types";

import { dateRangeValidator, loadAnalytics } from "./analyticsShared";

const PLATFORM_METRIC_DATASETS = [
  "analytics",
  "metaInsights",
] as const satisfies readonly AnalyticsSourceKey[];

const CHANNEL_REVENUE_DATASETS = [
  "orders",
] as const satisfies readonly AnalyticsSourceKey[];

export const getPlatformMetricsSummary = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
      organizationId: v.string(),
      metrics: v.any(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const response = await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range, {
      datasets: PLATFORM_METRIC_DATASETS,
    });

    const metrics = computePlatformMetrics(response);

    return {
      dateRange: response.dateRange,
      organizationId: response.organizationId,
      metrics,
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      metrics: PlatformMetrics;
    };
  },
});

export const getChannelRevenueSummary = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
      organizationId: v.string(),
      channels: v.any(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const response = await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range, {
      datasets: CHANNEL_REVENUE_DATASETS,
    });
    const breakdown = computeChannelRevenue(response);

    return {
      dateRange: response.dateRange,
      organizationId: response.organizationId,
      channels: breakdown,
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      channels: ChannelRevenueBreakdown;
    };
  },
});
