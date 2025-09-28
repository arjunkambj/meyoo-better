import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  validateDateRange,
  type AnalyticsSourceData,
  type AnalyticsSourceKey,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";

import {
  datasetValidator,
  defaultDateRange,
  loadAnalytics,
  responseValidator,
  type AnalyticsResponse,
} from "./analyticsShared";

const PLATFORM_METRIC_DATASETS = [
  "analytics",
  "metaInsights",
] as const satisfies readonly AnalyticsSourceKey[];

function computeCustomerSummary(orders: Array<Doc<"shopifyOrders"> | Record<string, any>>) {
  const customerMap = new Map<string, { orderCount: number; firstOrderAt: number }>();
  let totalRevenue = 0;

  for (const order of orders) {
    const customerId = order?.customerId ? String(order.customerId) : null;
    const createdAt = typeof order?.shopifyCreatedAt === "number" ? order.shopifyCreatedAt : null;
    totalRevenue += typeof order?.totalPrice === "number" ? order.totalPrice : 0;

    if (!customerId) {
      continue;
    }

    const record = customerMap.get(customerId) ?? {
      orderCount: 0,
      firstOrderAt: createdAt ?? Number.POSITIVE_INFINITY,
    };

    record.orderCount += 1;

    if (createdAt !== null && createdAt < record.firstOrderAt) {
      record.firstOrderAt = createdAt;
    }

    customerMap.set(customerId, record);
  }

  const totalCustomers = customerMap.size;
  const ordersCount = orders.length;
  const newCustomers = Array.from(customerMap.values()).filter(
    (entry) => entry.orderCount === 1,
  ).length;
  const returningCustomers = totalCustomers - newCustomers;

  return {
    totalCustomers,
    newCustomers,
    returningCustomers,
    avgOrderValue: ordersCount > 0 ? totalRevenue / ordersCount : 0,
    avgLifetimeValue: totalCustomers > 0 ? totalRevenue / Math.max(totalCustomers, 1) : 0,
  };
}

function filterByProductId(
  data: AnalyticsSourceData,
  productId: string,
): AnalyticsSourceData {
  const filteredOrderItems = data.orderItems.filter((item: any) =>
    String(item.productId ?? item.productId) === productId,
  );

  if (filteredOrderItems.length === 0) {
    return {
      ...data,
      orderItems: [],
      orders: [],
      products: data.products.filter((product: any) => String(product._id) === productId),
      variants: [],
    };
  }

  const orderIds = new Set(
    filteredOrderItems.map((item: any) => String(item.orderId ?? item.orderID ?? item.order_id)),
  );

  const variantIds = new Set(
    filteredOrderItems
      .map((item: any) => (item.variantId ? String(item.variantId) : null))
      .filter(Boolean) as string[],
  );

  return {
    ...data,
    orderItems: filteredOrderItems,
    orders: data.orders.filter((order: any) => orderIds.has(String(order._id))),
    products: data.products.filter((product: any) => String(product._id) === productId),
    variants: data.variants.filter((variant: any) => variantIds.has(String(variant._id))),
  };
}

export const getMetrics = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    metrics: v.optional(v.array(v.string())),
    granularity: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
  },
});

export const getProductAnalytics = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    productId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const base = await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);

    if (!args.productId) {
      return base;
    }

    const filtered = filterByProductId(base.data, args.productId);

    if (args.limit && args.limit > 0) {
      filtered.orderItems = filtered.orderItems.slice(0, args.limit);
    }

    return {
      ...base,
      data: filtered,
      meta: {
        productId: args.productId,
        limited: Boolean(args.limit && args.limit > 0),
      },
    } satisfies AnalyticsResponse;
  },
});

export const getCustomerInsights = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    segment: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
      data: datasetValidator,
      summary: v.object({
        totalCustomers: v.number(),
        newCustomers: v.number(),
        returningCustomers: v.number(),
        avgOrderValue: v.number(),
        avgLifetimeValue: v.number(),
      }),
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const response = await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);

    const summary = computeCustomerSummary(response.data.orders as Doc<"shopifyOrders">[]);

    return {
      dateRange: response.dateRange,
      data: response.data,
      summary,
      meta: args.segment ? { segment: args.segment } : undefined,
    };
  },
});

export const getRealtimeMetrics = query({
  args: {},
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const today = defaultDateRange(1);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, today);
  },
});

export const getProductPerformance = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
  },
});

export const getPlatformMetrics = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range, {
      datasets: PLATFORM_METRIC_DATASETS,
    });
  },
});

export const getChannelRevenue = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
  },
});

export const getCustomerAnalytics = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
  },
});

export const getRealTimeMetrics = query({
  args: {},
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = defaultDateRange(1);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
  },
});

export const getProfitLossOverview = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
  },
});

export const getCohortAnalysis = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: v.union(v.null(), responseValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    return await loadAnalytics(ctx, auth.orgId as Id<"organizations">, range);
  },
});

export const getComparisonMetrics = query({
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
    const currentRange = validateDateRange(args.currentRange);
    const current = await loadAnalytics(ctx, orgId, currentRange);

    if (!args.previousRange) {
      return { current };
    }

    const previousRange = validateDateRange(args.previousRange);
    const previous = await loadAnalytics(ctx, orgId, previousRange);

    return { current, previous };
  },
});
