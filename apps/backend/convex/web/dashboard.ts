import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { action, query, type ActionCtx, type QueryCtx } from "../_generated/server";
import { api } from "../_generated/api";
import {
  datasetValidator,
  dateRangeValidator,
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
import { DEFAULT_DASHBOARD_CONFIG } from "@repo/types";
import { getUserAndOrg } from "../utils/auth";
import { resolveDashboardConfig } from "../utils/dashboardConfig";
import { computeIntegrationStatus, integrationStatusValidator } from "../utils/integrationStatus";
import { loadAnalyticsWithChunks } from "../utils/analyticsLoader";
import { loadOverviewFromDailyMetrics } from "../utils/dailyMetrics";

type IntegrationStatus = Awaited<ReturnType<typeof computeIntegrationStatus>>;

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = DateRange;

type OverviewPayload = {
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

type OverviewArgs = {
  timeRange?: string;
  startDate?: string;
  endDate?: string;
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
  "metaInsights",
  "analytics",
] as const satisfies readonly AnalyticsSourceKey[];

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
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx: QueryCtx, args: OverviewArgs): Promise<OverviewPayload | null> => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = args.startDate && args.endDate
      ? validateDateRange({ startDate: args.startDate, endDate: args.endDate })
      : defaultDateRange(parseTimeRange(args.timeRange));
    const dailyOverview = await loadOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    const dashboardConfig = await resolveDashboardConfig(
      ctx,
      auth.user._id,
      auth.orgId,
    );
    const integrationStatus = await computeIntegrationStatus(ctx, auth.orgId);
    const primaryCurrency = auth.user.primaryCurrency ?? "USD";

    if (dailyOverview) {
      const basePayload: OverviewPayload = {
        dateRange: range,
        organizationId: auth.orgId,
        overview: dailyOverview.overview,
        platformMetrics: dailyOverview.platformMetrics,
        channelRevenue: null,
        primaryCurrency,
        dashboardConfig,
        integrationStatus,
        meta: {
          strategy: "dailyMetrics",
          ...dailyOverview.meta,
        },
      } satisfies OverviewPayload;

      const supplementalDatasets = dailyOverview.hasFullCoverage
        ? (["orders"] as const) // orders are required to populate channel revenue
        : (["orders", "metaInsights", "analytics"] as const);
      try {
        const analyticsResponse = await loadAnalytics(
          ctx,
          auth.orgId as Id<"organizations">,
          range,
          {
            datasets: supplementalDatasets,
          },
        );

        const channelRevenue = computeChannelRevenue(analyticsResponse);

        const platformMetrics = dailyOverview.hasFullCoverage
          ? basePayload.platformMetrics
          : computePlatformMetrics(analyticsResponse);

        const enhancedMeta: Record<string, unknown> = {
          strategy: "dailyMetrics",
          ...dailyOverview.meta,
          supplemental: {
            datasets: supplementalDatasets,
          },
        };

        if (analyticsResponse.meta) {
          enhancedMeta.analyticsMeta = analyticsResponse.meta;
        }

        return {
          ...basePayload,
          platformMetrics,
          channelRevenue,
          meta: enhancedMeta,
        } satisfies OverviewPayload;
      } catch (error) {
        const errorMeta: Record<string, unknown> = {
          datasets: supplementalDatasets,
        };

        if (error instanceof Error) {
          errorMeta.error = error.message;
          if (isTooManyReadsError(error)) {
            errorMeta.fallback = "too_many_reads";
          }
        }

        const fallbackMeta = isTooManyReadsError(error)
          ? { needsActionLoad: true, reason: "too_many_reads" }
          : undefined;

        return {
          ...basePayload,
          meta: {
            strategy: "dailyMetrics",
            ...dailyOverview.meta,
            supplemental: errorMeta,
            ...(fallbackMeta ?? {}),
          },
        } satisfies OverviewPayload;
      }
    }

    let analyticsResponse: AnalyticsResponse | null = null;
    let fallbackMeta: Record<string, unknown> | undefined;

    try {
      analyticsResponse = await loadDashboardAnalytics(
        ctx,
        auth.orgId as Id<"organizations">,
        range,
      );
    } catch (error) {
      if (isTooManyReadsError(error)) {
        fallbackMeta = { needsActionLoad: true, reason: "too_many_reads" };
      } else {
        throw error;
      }
    }

    if (!analyticsResponse) {
      return {
        dateRange: range,
        organizationId: auth.orgId,
        overview: null,
        platformMetrics: null,
        channelRevenue: null,
        primaryCurrency: auth.user.primaryCurrency ?? "USD",
        dashboardConfig,
        integrationStatus,
        meta: {
          ...(fallbackMeta ?? {}),
        },
      } satisfies OverviewPayload;
    }

    const overview = computeOverviewMetrics(analyticsResponse);
    const platformMetrics = computePlatformMetrics(analyticsResponse);
    const channelRevenue = computeChannelRevenue(analyticsResponse);
    return {
      dateRange: analyticsResponse.dateRange,
      organizationId: analyticsResponse.organizationId,
      overview,
      platformMetrics,
      channelRevenue,
      primaryCurrency: auth.user.primaryCurrency ?? "USD",
      dashboardConfig,
      integrationStatus,
      meta: analyticsResponse.meta,
    } satisfies OverviewPayload;
  },
});

const getOverviewDataActionDefinition = {
  args: {
    timeRange: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
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
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx: ActionCtx, args: OverviewArgs): Promise<OverviewPayload | null> => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = args.startDate && args.endDate
      ? validateDateRange({ startDate: args.startDate, endDate: args.endDate })
      : defaultDateRange(parseTimeRange(args.timeRange));

    const { data, meta } = await loadAnalyticsWithChunks(
      ctx,
      auth.orgId as Id<"organizations">,
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
        const { data: previousData, meta: previousMeta } = await loadAnalyticsWithChunks(
          ctx,
          auth.orgId as Id<"organizations">,
          previousRange,
          {
            datasets: DASHBOARD_SUMMARY_DATASETS,
          },
        );

        previousAnalyticsResponse = {
          dateRange: previousRange,
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

    const overview = computeOverviewMetrics(analyticsResponse, previousAnalyticsResponse);
    const platformMetrics = computePlatformMetrics(analyticsResponse);
    const channelRevenue = computeChannelRevenue(analyticsResponse);

    return {
      dateRange: analyticsResponse.dateRange,
      organizationId: analyticsResponse.organizationId,
      overview,
      platformMetrics,
      channelRevenue,
      primaryCurrency: auth.user.primaryCurrency ?? "USD",
      dashboardConfig: dashboardLayout ?? DEFAULT_DASHBOARD_CONFIG,
      integrationStatus,
      meta: {
        ...(analyticsResponse.meta ?? {}),
        ...(previousRange ? { previousRange } : {}),
      },
    } satisfies OverviewPayload;
  },
};

export const getOverviewDataAction = action(getOverviewDataActionDefinition);

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
    dateRange: v.optional(dateRangeValidator),
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
    dateRange: v.optional(dateRangeValidator),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(7);
    return await runDashboardQuery(ctx, range);
  },
});

export const getPerformanceIndicators = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(30);
    return await runDashboardQuery(ctx, range);
  },
});

export const getTrendingMetrics = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(14);
    return await runDashboardQuery(ctx, range);
  },
});

export const getActivityFeed = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
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
      dateRange: dateRangeValidator,
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
