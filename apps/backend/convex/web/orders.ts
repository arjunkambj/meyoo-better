import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { action, query, type QueryCtx } from "../_generated/server";
import { api } from "../_generated/api";
import {
  dateRangeValidator,
  defaultDateRange,
  loadAnalytics,
  responseValidator,
  type AnalyticsResponse,
} from "./analyticsShared";
import {
  fetchAnalyticsOrderChunk,
  type AnalyticsSourceKey,
  type DateRange,
  validateDateRange,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { computeOrdersAnalytics } from "../utils/analyticsAggregations";
import type {
  AnalyticsOrder,
  OrdersAnalyticsResult,
  OrdersFulfillmentMetrics,
  OrdersOverviewMetrics,
} from "@repo/types";
import { loadAnalyticsWithChunks } from "../utils/analyticsLoader";
import { loadOverviewFromDailyMetrics } from "../utils/dailyMetrics";

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = DateRange;

const ORDER_ANALYTICS_DATASETS = [
  "orders",
  "orderItems",
  "variants",
  "variantCosts",
  "globalCosts",
  "manualReturnRates",
  "metaInsights",
  "analytics",
] as const satisfies readonly AnalyticsSourceKey[];

const DEFAULT_ORDERS_PAGE_SIZE = 50;
const MAX_ORDERS_PAGE_SIZE = 200;
const MIN_ORDERS_PAGE_SIZE = 1;
const MAX_CURSOR_CARRY = 100;
const END_CURSOR = "__end__";
const DAY_MS = 24 * 60 * 60 * 1000;

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

type OrdersCursorState = {
  chunkCursor: string | null;
  carry: AnalyticsOrder[];
  done: boolean;
  key: string;
};

function stripLineItems(order: AnalyticsOrder): AnalyticsOrder {
  const { lineItems: _lineItems, ...rest } = order;
  return { ...rest } as AnalyticsOrder;
}

function sortOrdersByCreatedAtDesc(a: AnalyticsOrder, b: AnalyticsOrder): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function buildCursorKey(args: {
  dateRange: DateRangeArg;
  status?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): string {
  return JSON.stringify({
    dateRange: args.dateRange,
    status: args.status ?? null,
    searchTerm: args.searchTerm ?? null,
    sortBy: args.sortBy ?? null,
    sortOrder: args.sortOrder ?? null,
  });
}

function encodeOrdersCursor(state: OrdersCursorState): string {
  const carry = state.carry.slice(0, MAX_CURSOR_CARRY);

  if ((state.chunkCursor === null || state.done) && carry.length === 0) {
    return END_CURSOR;
  }

  return JSON.stringify({
    chunkCursor: state.chunkCursor,
    carry,
    done: state.done,
    key: state.key,
  });
}

function decodeOrdersCursor(cursor: string | null): OrdersCursorState | null {
  if (!cursor || cursor === END_CURSOR) {
    return null;
  }

  try {
    const parsed = JSON.parse(cursor) as Partial<OrdersCursorState>;
    const chunkCursor = typeof parsed.chunkCursor === "string" ? parsed.chunkCursor : null;
    const carry = Array.isArray(parsed.carry)
      ? (parsed.carry as AnalyticsOrder[])
      : [];
    const done = typeof parsed.done === "boolean" ? parsed.done : false;
    const key = typeof parsed.key === "string" ? parsed.key : "";

    return {
      chunkCursor,
      carry: carry.slice(0, MAX_CURSOR_CARRY),
      done,
      key,
    } satisfies OrdersCursorState;
  } catch (error) {
    console.warn("Failed to decode orders cursor", error);
    return null;
  }
}

const ZERO_ORDERS_OVERVIEW: OrdersOverviewMetrics = {
  totalOrders: 0,
  cancelledOrders: 0,
  totalRevenue: 0,
  totalCosts: 0,
  netProfit: 0,
  totalTax: 0,
  avgOrderValue: 0,
  customerAcquisitionCost: 0,
  grossMargin: 0,
  fulfillmentRate: 0,
  changes: {
    totalOrders: 0,
    revenue: 0,
    netProfit: 0,
    avgOrderValue: 0,
    cac: 0,
    margin: 0,
    fulfillmentRate: 0,
  },
};

const ordersOverviewValidator = v.object({
  totalOrders: v.number(),
  cancelledOrders: v.optional(v.number()),
  totalRevenue: v.number(),
  totalCosts: v.number(),
  netProfit: v.number(),
  totalTax: v.number(),
  avgOrderValue: v.number(),
  customerAcquisitionCost: v.number(),
  grossMargin: v.number(),
  fulfillmentRate: v.number(),
  changes: v.object({
    totalOrders: v.number(),
    revenue: v.number(),
    netProfit: v.number(),
    avgOrderValue: v.number(),
    cac: v.number(),
    margin: v.number(),
    fulfillmentRate: v.number(),
  }),
});

const fulfillmentMetricsValidator = v.object({
  avgProcessingTime: v.number(),
  avgShippingTime: v.number(),
  avgDeliveryTime: v.number(),
  onTimeDeliveryRate: v.number(),
  fulfillmentAccuracy: v.number(),
  returnRate: v.number(),
  avgFulfillmentCost: v.optional(v.number()),
  totalOrders: v.optional(v.number()),
});

const ZERO_FULFILLMENT_METRICS: OrdersFulfillmentMetrics = {
  avgProcessingTime: 0,
  avgShippingTime: 0,
  avgDeliveryTime: 0,
  onTimeDeliveryRate: 0,
  fulfillmentAccuracy: 0,
  returnRate: 0,
  avgFulfillmentCost: 0,
  totalOrders: 0,
};

const analyticsOrderValidator = v.object({
  id: v.string(),
  orderNumber: v.string(),
  customer: v.object({
    name: v.string(),
    email: v.string(),
  }),
  status: v.string(),
  fulfillmentStatus: v.string(),
  financialStatus: v.string(),
  items: v.number(),
  totalPrice: v.number(),
  totalCost: v.number(),
  profit: v.number(),
  profitMargin: v.number(),
  taxAmount: v.number(),
  shippingCost: v.number(),
  paymentMethod: v.string(),
  tags: v.optional(v.array(v.string())),
  shippingAddress: v.object({
    city: v.string(),
    country: v.string(),
  }),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const ordersPageResultValidator = v.object({
  page: v.array(analyticsOrderValidator),
  continueCursor: v.string(),
  isDone: v.boolean(),
  info: v.object({
    pageSize: v.number(),
    returned: v.number(),
    hasMore: v.boolean(),
  }),
});

const ordersPaginationValidator = v.object({
  cursor: v.optional(v.union(v.string(), v.null())),
  numItems: v.optional(v.number()),
});

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
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleOrdersQuery(ctx, args.dateRange);
  },
});

export const getOrdersOverviewMetrics = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: v.union(
    v.null(),
    v.object({
      metrics: ordersOverviewValidator,
      meta: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const dailyOverview = await loadOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    const metrics = dailyOverview?.ordersOverview ?? ZERO_ORDERS_OVERVIEW;
    const meta: Record<string, unknown> = {
      strategy: "dailyMetrics",
      status: dailyOverview ? "ready" : "pending",
      hasFullCoverage: dailyOverview?.hasFullCoverage ?? false,
    };

    if (dailyOverview) {
      meta.sourceMeta = dailyOverview.meta;
    }

    return {
      metrics,
      meta,
    };
  },
});

export const getRevenueSumForRange = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleOrdersQuery(ctx, args.dateRange);
  },
});

export const getOrdersList = query({
  args: {
    dateRange: dateRangeValidator,
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

export const getOrdersTablePage = query({
  args: {
    dateRange: dateRangeValidator,
    status: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(ordersPaginationValidator),
  },
  returns: ordersPageResultValidator,
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);

    if (!auth) {
      return {
        page: [],
        continueCursor: END_CURSOR,
        isDone: true,
        info: {
          pageSize: DEFAULT_ORDERS_PAGE_SIZE,
          returned: 0,
          hasMore: false,
        },
      };
    }

    const range = validateDateRange(args.dateRange);
    const cursorKey = buildCursorKey({
      dateRange: args.dateRange,
      status: args.status,
      searchTerm: args.searchTerm,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
    });

    const requestedItems = args.paginationOpts?.numItems ?? DEFAULT_ORDERS_PAGE_SIZE;
    const pageSize = Math.max(
      MIN_ORDERS_PAGE_SIZE,
      Math.min(requestedItems, MAX_ORDERS_PAGE_SIZE),
    );

    const decodedState = decodeOrdersCursor(args.paginationOpts?.cursor ?? null);
    const initialState = decodedState && decodedState.key === cursorKey ? decodedState : null;

    const bufferMap = new Map<string, AnalyticsOrder>();
    if (initialState) {
      for (const order of initialState.carry) {
        bufferMap.set(order.id, order);
      }
    }

    let chunkCursor = initialState?.chunkCursor ?? null;
    let done = initialState?.done ?? false;

    const takeFromBuffer = (results: AnalyticsOrder[]): void => {
      if (results.length >= pageSize || bufferMap.size === 0) {
        return;
      }

      const ordered = Array.from(bufferMap.values()).sort(sortOrdersByCreatedAtDesc);
      for (const order of ordered) {
        if (results.length >= pageSize) {
          break;
        }

        if (!bufferMap.has(order.id)) {
          continue;
        }

        results.push(order);
        bufferMap.delete(order.id);
      }
    };

    const results: AnalyticsOrder[] = [];
    takeFromBuffer(results);

    while (results.length < pageSize && !done) {
      const chunk = await fetchAnalyticsOrderChunk(
        ctx,
        auth.orgId as Id<"organizations">,
        range,
        {
          cursor: chunkCursor ?? undefined,
          pageSize: Math.max(pageSize, DEFAULT_ORDERS_PAGE_SIZE),
          datasets: ORDER_ANALYTICS_DATASETS,
        },
      );

      chunkCursor = chunk.cursor ?? null;
      if (chunk.isDone && !chunkCursor) {
        done = true;
      }

      const chunkResponse: AnalyticsResponse = {
        dateRange: range,
        organizationId: auth.orgId,
        data: {
          orders: chunk.data.orders,
          orderItems: chunk.data.orderItems,
          transactions: chunk.data.transactions,
          refunds: chunk.data.refunds,
          fulfillments: chunk.data.fulfillments,
          products: chunk.data.products,
          variants: chunk.data.variants,
          customers: chunk.data.customers,
          metaInsights: [],
          globalCosts: [],
          variantCosts: chunk.data.variantCosts,
          manualReturnRates: [],
          sessions: [],
          analytics: [],
        },
      } satisfies AnalyticsResponse;

      const computed = computeOrdersAnalytics(chunkResponse, {
        status: args.status ?? undefined,
        searchTerm: args.searchTerm ?? undefined,
        sortBy: args.sortBy ?? undefined,
        sortOrder: args.sortOrder ?? undefined,
        page: 1,
        pageSize: Math.max(chunk.data.orders.length, pageSize),
      });

      const chunkOrders = computed.orders?.data ?? [];
      for (const order of chunkOrders) {
        const sanitized = stripLineItems(order);
        bufferMap.set(sanitized.id, sanitized);
      }

      takeFromBuffer(results);

      if (chunk.isDone && bufferMap.size === 0) {
        done = true;
      }

      if (chunk.isDone && !chunkCursor) {
        done = true;
      }

      if (chunk.isDone && results.length >= pageSize) {
        break;
      }

      if (chunk.isDone && results.length < pageSize) {
        // No more data available
        done = true;
        break;
      }
    }

    const remaining = Array.from(bufferMap.values()).sort(sortOrdersByCreatedAtDesc);
    const hasMore = remaining.length > 0 || !done;

    const nextCursor = hasMore
      ? encodeOrdersCursor({
          chunkCursor,
          carry: remaining,
          done,
          key: cursorKey,
        })
      : END_CURSOR;

    return {
      page: results,
      continueCursor: nextCursor,
      isDone: !hasMore,
      info: {
        pageSize,
        returned: results.length,
        hasMore,
      },
    };
  },
});

export const getStatusDistribution = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: responseOrNull,
  handler: async (ctx, args) => {
    return await handleOrdersQuery(ctx, args.dateRange);
  },
});

export const getFulfillmentMetrics = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: v.union(v.null(), fulfillmentMetricsValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);
    const dailyOverview = await loadOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    if (!dailyOverview) {
      return ZERO_FULFILLMENT_METRICS;
    }

    const aggregates = dailyOverview.aggregates;
    const totalOrders = dailyOverview.ordersOverview?.totalOrders ?? aggregates.orders ?? 0;
    const fulfillmentRate = dailyOverview.ordersOverview?.fulfillmentRate ?? 0;
    const returnRate = aggregates.orders > 0 ? (aggregates.returnedOrders / aggregates.orders) * 100 : 0;
    const totalFulfillmentCost = aggregates.shippingCosts + aggregates.handlingFees;
    const avgFulfillmentCost = aggregates.orders > 0 ? totalFulfillmentCost / aggregates.orders : 0;

    return {
      avgProcessingTime: 0,
      avgShippingTime: 0,
      avgDeliveryTime: 0,
      onTimeDeliveryRate: fulfillmentRate,
      fulfillmentAccuracy: fulfillmentRate,
      returnRate,
      avgFulfillmentCost,
      totalOrders,
    } satisfies OrdersFulfillmentMetrics;
  },
});

export const getOrderTimeline = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
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
    dateRange: dateRangeValidator,
    organizationId: v.string(),
    result: v.optional(v.any()),
  }),
);

export const getAnalytics = action({
  args: {
    dateRange: dateRangeValidator,
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

    const previousRange = derivePreviousRange(range);
    let previousResponse: AnalyticsResponse | null = null;

    if (previousRange) {
      try {
        const { data: previousData, meta: previousMeta } = await loadAnalyticsWithChunks(
          ctx,
          auth.orgId as Id<"organizations">,
          previousRange,
          {
            datasets: ORDER_ANALYTICS_DATASETS,
          },
        );

        previousResponse = {
          dateRange: previousRange,
          organizationId: auth.orgId,
          data: previousData,
          ...(previousMeta ? { meta: previousMeta } : {}),
        };
      } catch (error) {
        console.error("Failed to load previous orders analytics:", error);
      }
    }

    const result = computeOrdersAnalytics(response, {
      status: args.status ?? undefined,
      searchTerm: args.searchTerm ?? undefined,
      sortBy: args.sortBy ?? undefined,
      sortOrder: args.sortOrder ?? undefined,
      page: args.page ?? undefined,
      pageSize: args.pageSize ?? undefined,
    }, previousResponse ?? undefined);

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

export const getOrdersMetrics = action({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: v.union(
    v.null(),
    v.object({
      overview: v.union(
        v.null(),
        v.object({
          metrics: ordersOverviewValidator,
          meta: v.optional(v.any()),
        }),
      ),
      fulfillment: v.union(v.null(), fulfillmentMetricsValidator),
    }),
  ),
  handler: async (ctx, args): Promise<{
    overview: {
      metrics: any;
      meta?: any;
    } | null;
    fulfillment: any;
  } | null> => {
    const [overview, fulfillment] = await Promise.all([
      ctx.runQuery(api.web.orders.getOrdersOverviewMetrics, {
        dateRange: args.dateRange,
      }),
      ctx.runQuery(api.web.orders.getFulfillmentMetrics, {
        dateRange: args.dateRange,
      }),
    ]);

    return {
      overview,
      fulfillment,
    };
  },
});
