import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { action, query, type QueryCtx } from "../_generated/server";
import {
  defaultDateRange,
  loadAnalytics,
  responseValidator,
  type AnalyticsResponse,
} from "./analyticsShared";
import { type AnalyticsSourceKey, validateDateRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { computeOrdersAnalytics } from "../utils/analyticsAggregations";
import type { OrdersAnalyticsResult } from "@repo/types";
import { loadAnalyticsWithChunks } from "../utils/analyticsLoader";

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = { startDate: string; endDate: string };

const ORDER_ANALYTICS_DATASETS = [
  "orders",
  "orderItems",
  "variants",
  "variantCosts",
  "globalCosts",
  "metaInsights",
  "analytics",
] as const satisfies readonly AnalyticsSourceKey[];

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

const analyticsActionReturns = v.union(
  v.null(),
  v.object({
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    organizationId: v.string(),
    result: v.optional(v.any()),
  }),
);

export const getAnalytics = action({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    status: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  returns: analyticsActionReturns,
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const { data, meta } = await loadAnalyticsWithChunks(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
      {
        datasets: ORDER_ANALYTICS_DATASETS,
      },
    );

    const response: AnalyticsResponse = {
      dateRange: range,
      organizationId: auth.orgId,
      data,
      ...(meta ? { meta } : {}),
    };

    const result = computeOrdersAnalytics(response, {
      status: args.status ?? undefined,
      searchTerm: args.searchTerm ?? undefined,
      sortBy: args.sortBy ?? undefined,
      sortOrder: args.sortOrder ?? undefined,
      page: args.page ?? undefined,
      pageSize: args.pageSize ?? undefined,
    });

    return {
      dateRange: response.dateRange,
      organizationId: response.organizationId,
      result,
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      result: OrdersAnalyticsResult;
    };
  },
});
