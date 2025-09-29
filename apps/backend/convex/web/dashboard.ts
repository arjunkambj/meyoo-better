import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import {
  datasetValidator,
  defaultDateRange,
  loadAnalytics,
  responseValidator,
  type AnalyticsResponse,
} from "./analyticsShared";
import {
  validateDateRange,
  type AnalyticsSourceKey,
  type DateRange,
} from "../utils/analyticsSource";
import { computeOverviewMetrics, computePlatformMetrics, computeChannelRevenue } from "../utils/analyticsAggregations";
import type { OverviewComputation, ChannelRevenueBreakdown, PlatformMetrics } from "@repo/types";
import { getUserAndOrg } from "../utils/auth";
import { resolveDashboardConfig } from "../utils/dashboardConfig";
import { computeIntegrationStatus, integrationStatusValidator } from "../utils/integrationStatus";

type IntegrationStatus = Awaited<ReturnType<typeof computeIntegrationStatus>>;

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = { startDate: string; endDate: string };

const DASHBOARD_SUMMARY_DATASETS = [
  "orders",
  "customers",
  "costs",
  "metaInsights",
  "analytics",
] as const satisfies readonly AnalyticsSourceKey[];

async function loadDashboardAnalytics(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  range: DateRange,
): Promise<AnalyticsResponse> {
  return await loadAnalytics(ctx, orgId, range, {
    datasets: DASHBOARD_SUMMARY_DATASETS,
  });
}


type QueryHandler = (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  range: DateRange,
  extraArgs?: Record<string, unknown>,
) => Promise<AnalyticsResponse>;

async function runDashboardQuery(
  ctx: QueryCtx,
  dateRange: DateRangeArg | DateRange,
  handler?: QueryHandler,
  extraArgs?: Record<string, unknown>,
) {
  const auth = await getUserAndOrg(ctx);
  if (!auth) return null;

  const range = validateDateRange(dateRange);

  if (handler) {
    return handler(ctx, auth.orgId as Id<"organizations">, range, extraArgs);
  }

  return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
}

export const getOverviewData = query({
  args: {
    timeRange: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
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
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = args.startDate && args.endDate
      ? validateDateRange({ startDate: args.startDate, endDate: args.endDate })
      : defaultDateRange(parseTimeRange(args.timeRange));

    const response = await loadDashboardAnalytics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    const overview = computeOverviewMetrics(response);
    const platformMetrics = computePlatformMetrics(response);
    const channelRevenue = computeChannelRevenue(response);
    const dashboardConfig = await resolveDashboardConfig(
      ctx,
      auth.user._id,
      auth.orgId,
    );
    const integrationStatus = await computeIntegrationStatus(ctx, auth.orgId);
    return {
      dateRange: response.dateRange,
      organizationId: response.organizationId,
      overview,
      platformMetrics,
      channelRevenue,
      primaryCurrency: auth.user.primaryCurrency ?? "USD",
      dashboardConfig,
      integrationStatus,
      meta: response.meta,
    } satisfies {
      dateRange: DateRange;
      organizationId: string;
      overview: OverviewComputation | null;
      platformMetrics: PlatformMetrics | null | undefined;
      channelRevenue: ChannelRevenueBreakdown | null | undefined;
      primaryCurrency?: string;
      dashboardConfig: { kpis: string[]; widgets: string[] };
      integrationStatus: IntegrationStatus;
      meta?: Record<string, unknown> | undefined;
    };
  },
});

export const getDashboardSummary = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await runDashboardQuery(
      ctx,
      { startDate: args.startDate, endDate: args.endDate },
      loadDashboardAnalytics,
    );
  },
});

export const getTrendingProducts = query({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
    limit: v.optional(v.number()),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange();
    const response = await runDashboardQuery(ctx, range);

    if (!response) return null;

    const limit = args.limit && args.limit > 0 ? args.limit : undefined;

    return {
      ...response,
      meta: {
        limit,
        note: "Client is responsible for computing trending products from raw data.",
      },
    };
  },
});

export const getRecentActivity = query({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(7);
    return await runDashboardQuery(ctx, range);
  },
});

export const getPerformanceIndicators = query({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(30);
    return await runDashboardQuery(ctx, range);
  },
});

export const getTrendingMetrics = query({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(14);
    return await runDashboardQuery(ctx, range);
  },
});

export const getActivityFeed = query({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
    limit: v.optional(v.number()),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(14);
    const response = await runDashboardQuery(ctx, range);

    if (!response) return null;

    return {
      ...response,
      meta: {
        limit: args.limit,
        note: "Client should sort and truncate activity feed based on raw data.",
      },
    };
  },
});

export const getSyncStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
      data: datasetValidator,
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = defaultDateRange(1);
    const response = await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);

    return {
      dateRange: response.dateRange,
      data: response.data,
      meta: {
        message:
          "Use raw datasets to derive sync status. Server no longer tracks realtime metrics cache.",
      },
    };
  },
});

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
