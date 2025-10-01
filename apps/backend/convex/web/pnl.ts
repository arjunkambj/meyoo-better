import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import {
  defaultDateRange,
  loadAnalytics,
  responseValidator,
  type AnalyticsResponse,
} from "./analyticsShared";
import { validateDateRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { computePnLAnalytics } from "../utils/analyticsAggregations";
import {
  loadPnLAnalyticsFromDailyMetrics,
  type DailyPnLMeta,
} from "../utils/dailyMetrics";
import type { PnLAnalyticsResult, PnLGranularity } from "@repo/types";

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = { startDate: string; endDate: string };

type QueryHandler = (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  range: DateRangeArg,
) => Promise<AnalyticsResponse>;

async function handleQuery(
  ctx: QueryCtx,
  dateRange: DateRangeArg,
  handler?: QueryHandler,
) {
  const auth = await getUserAndOrg(ctx);
  if (!auth) return null;

  const range = validateDateRange(dateRange);

  if (handler) {
    return handler(ctx, auth.orgId as Id<"organizations">, range);
  }

  return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
}

export const getMetrics = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getWaterfallData = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getCostBreakdown = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getMarginAnalysis = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getTrends = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getComparison = query({
  args: {
    currentRange: v.object({ startDate: v.string(), endDate: v.string() }),
    previousRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
  },
  returns: v.union(
    v.null(),
    v.object({
      current: responseValidator,
      previous: v.optional(responseValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const orgId = auth.orgId as Id<"organizations">;
    const current = await loadAnalytics(
      ctx,
      orgId,
      validateDateRange(args.currentRange),
    );

    if (!args.previousRange) {
      return { current };
    }

    const previous = await loadAnalytics(
      ctx,
      orgId,
      validateDateRange(args.previousRange),
    );

    return { current, previous };
  },
});

export const getMarketingEfficiency = query({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(30);
    return await handleQuery(ctx, range);
  },
});

export const getContributionMargin = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getTableData = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    granularity: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getAnalytics = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    granularity: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
      organizationId: v.string(),
      result: v.optional(v.any()),
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const organizationId = auth.orgId as Id<"organizations">;
    const granularity = (args.granularity ?? "daily") as PnLGranularity;

    const dailyMetrics = await loadPnLAnalyticsFromDailyMetrics(
      ctx,
      organizationId,
      range,
      granularity,
    );

    if (dailyMetrics.meta.hasData) {
      const dailyMeta: DailyPnLMeta = dailyMetrics.meta;
      return {
        dateRange: range,
        organizationId: auth.orgId as string,
        result: dailyMetrics.result,
        meta: {
          strategy: "dailyMetrics",
          ...dailyMeta,
        },
      } satisfies {
        dateRange: { startDate: string; endDate: string };
        organizationId: string;
        result: PnLAnalyticsResult;
        meta: Record<string, unknown>;
      };
    }

    const analytics = await loadAnalytics(ctx, organizationId, range, {
      datasets: ["orders", "metaInsights", "globalCosts"],
    });
    const result = computePnLAnalytics(analytics, granularity);

    return {
      dateRange: range,
      organizationId: auth.orgId as string,
      result,
      meta: {
        strategy: "analytics",
        ...(analytics.meta ?? {}),
      },
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      result: PnLAnalyticsResult;
      meta: Record<string, unknown>;
    };
  },
});
