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
  "manualReturnRates",
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

    const dashboardConfig = await resolveDashboardConfig(
      ctx,
      auth.user._id,
      auth.orgId,
    );
    // Read cached status via query to avoid recomputation and large reads
    const integrationStatus = await ctx.runQuery(api.core.status.getIntegrationStatus, {});
    const orgDoc = await ctx.db.get(auth.orgId as Id<"organizations">);
    const primaryCurrency = orgDoc?.primaryCurrency ?? "USD";

    // ONLY read from dailyMetrics (aggregated data) - no raw order reads
    const dailyOverview = await loadOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
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
        meta: {
          strategy: "dailyMetrics",
          status: "calculating",
          message: "Metrics are being calculated. This usually takes 10-30 seconds after sync completion.",
        },
      } satisfies OverviewPayload;
    }

    // Metrics available from dailyMetrics table
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

    // Try to load minimal supplemental data for channel revenue
    // Using small dataset to avoid large reads
    const supplementalDatasets = ["orders"] as const;
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

      return {
        ...basePayload,
        channelRevenue,
        meta: {
          strategy: "dailyMetrics",
          ...dailyOverview.meta,
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
      primaryCurrency:
        (await ctx.runQuery(api.core.currency.getPrimaryCurrencyForOrg, {
          orgId: auth.orgId as Id<"organizations">,
        })) ?? "USD",
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
