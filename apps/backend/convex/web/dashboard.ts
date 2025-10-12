import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { action, query, type ActionCtx, type QueryCtx } from "../_generated/server";
import { api } from "../_generated/api";
import {
  dateRangeValidator,
  defaultDateRange,
  type AnalyticsResponse,
} from "./analyticsShared";
import { percentageChange } from "../utils/analytics/shared";
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
    applyUtmRoasMetric(overview, dailyOverview.channelRevenue);

    const meta: Record<string, unknown> = {
      ...(dailyOverview.meta ?? {}),
      strategy: "dailyMetrics",
      userRole,
      canViewDevTools,
      channelRevenueSource: "dailyMetrics",
    };

    const basePayload: OverviewPayload = {
      dateRange: range,
      organizationId: auth.orgId,
      overview,
      platformMetrics: dailyOverview.platformMetrics,
      channelRevenue: dailyOverview.channelRevenue ?? null,
      primaryCurrency,
      dashboardConfig,
      integrationStatus,
      onboardingStatus,
      meta,
    } satisfies OverviewPayload;

    return basePayload;
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
