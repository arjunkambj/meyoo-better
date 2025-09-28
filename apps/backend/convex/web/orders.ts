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

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = { startDate: string; endDate: string };

type QueryHandler = (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  range: DateRangeArg,
  extra?: Record<string, unknown>,
) => Promise<AnalyticsResponse>;

async function handleOrdersQuery(
  ctx: QueryCtx,
  dateRange: DateRangeArg,
  handler?: QueryHandler,
  extra?: Record<string, unknown>,
) {
  const auth = await getUserAndOrg(ctx);
  if (!auth) return null;

  const range = validateDateRange(dateRange);

  if (handler) {
    return handler(ctx, auth.orgId as Id<"organizations">, range, extra);
  }

  return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
}

export const getOrdersOverview = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleOrdersQuery(ctx, args.dateRange);
  },
});

export const getRevenueSumForRange = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleOrdersQuery(ctx, args.dateRange);
  },
});

export const getOrdersList = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    limit: v.optional(v.number()),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const response = await handleOrdersQuery(ctx, args.dateRange);

    if (!response) return null;

    return {
      ...response,
      meta: {
        limit: args.limit,
        note: "Client should apply pagination, sorting, and limiting to raw orders.",
      },
    };
  },
});

export const getStatusDistribution = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleOrdersQuery(ctx, args.dateRange);
  },
});

export const getFulfillmentMetrics = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleOrdersQuery(ctx, args.dateRange);
  },
});

export const getOrderTimeline = query({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    const range = args.dateRange ?? defaultDateRange(14);
    return await handleOrdersQuery(ctx, range);
  },
});
