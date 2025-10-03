import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import {
  dateRangeValidator,
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
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getWaterfallData = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getCostBreakdown = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getMarginAnalysis = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getTrends = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getComparison = query({
  args: {
    currentRange: dateRangeValidator,
    previousRange: v.optional(dateRangeValidator),
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
    dateRange: v.optional(dateRangeValidator),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(30);
    return await handleQuery(ctx, range);
  },
});

export const getContributionMargin = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleQuery(ctx, args.dateRange);
  },
});

export const getTableData = query({
  args: {
    dateRange: dateRangeValidator,
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
    dateRange: dateRangeValidator,
    granularity: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
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

    const meta: Record<string, unknown> = {
      strategy: "dailyMetrics",
      status: dailyMetrics.meta.hasData ? "ready" : "pending",
      ...dailyMetrics.meta,
    };

    return {
      dateRange: range,
      organizationId: auth.orgId as string,
      result: dailyMetrics.result,
      meta,
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      result: PnLAnalyticsResult;
      meta: Record<string, unknown>;
    };
  },
});
