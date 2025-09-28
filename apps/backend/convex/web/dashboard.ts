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
import { validateDateRange, type DateRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = { startDate: string; endDate: string };

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

export const getDashboardSummary = query({
  args: {
    timeRange: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange(parseTimeRange(args.timeRange));
    return await runDashboardQuery(ctx, range);
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
