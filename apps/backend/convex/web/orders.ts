import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { action, query } from "../_generated/server";
import { dateRangeValidator, type AnalyticsResponse } from "./analyticsShared";
import {
  fetchAnalyticsOrderChunk,
  type AnalyticsSourceKey,
  type DateRange,
  validateDateRange,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import {
  DEFAULT_JOURNEY_STAGES,
  loadCustomerJourneyStages,
} from "../utils/customerJourney";
import { computeOrdersAnalytics } from "../utils/analyticsAggregations";
import type {
  AnalyticsOrder,
  OrdersAnalyticsResult,
  OrdersFulfillmentMetrics,
  OrdersOverviewMetrics,
  MetricWithChange,
  OrdersInsightsKPIs,
  OrdersInsightsPayload,
} from "@repo/types";
import { loadAnalyticsWithChunks } from "../utils/analyticsLoader";
import {
  loadOverviewFromDailyMetrics,
  type DailyMetricsOverview,
} from "../utils/dailyMetrics";

const ORDER_ANALYTICS_DATASETS = [
  "orders",
  "orderItems",
  "transactions",
  "refunds",
  "fulfillments",
  "variants",
  "variantCosts",
] as const satisfies readonly AnalyticsSourceKey[];

const DEFAULT_ORDERS_PAGE_SIZE = 50;
const MAX_ORDERS_PAGE_SIZE = 50;
const MAX_ORDERS_FETCH_SIZE = 200;
const ORDERS_FETCH_MULTIPLIER = 3;
const MIN_ORDERS_PAGE_SIZE = 1;
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

function stripLineItems(order: AnalyticsOrder): AnalyticsOrder {
  const { lineItems: _lineItems, ...rest } = order;
  return { ...rest } as AnalyticsOrder;
}

function sortAnalyticsOrders(
  orders: AnalyticsOrder[],
  sortBy?: string | null,
  sortOrder: "asc" | "desc" = "desc",
): AnalyticsOrder[] {
  if (!sortBy) {
    return [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  const direction = sortOrder === "asc" ? 1 : -1;

  return [...orders].sort((a, b) => {
    switch (sortBy) {
      case "revenue":
        return (a.totalPrice - b.totalPrice) * direction;
      case "profit":
        return (a.profit - b.profit) * direction;
      case "orders":
        return (a.items - b.items) * direction;
      case "status":
        return a.status.localeCompare(b.status) * direction;
      default: {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return (aTime - bTime) * direction;
      }
    }
  });
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
  prepaidRate: 0,
  repeatRate: 0,
  rtoRevenueLoss: 0,
  abandonedCustomers: 0,
  changes: {
    totalOrders: 0,
    revenue: 0,
    netProfit: 0,
    avgOrderValue: 0,
    cac: 0,
    margin: 0,
    fulfillmentRate: 0,
    prepaidRate: 0,
    repeatRate: 0,
    rtoRevenueLoss: 0,
    abandonedCustomers: 0,
  },
};

const safeNumber = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

function buildInsightsKpis(
  metrics: OrdersOverviewMetrics | null,
): OrdersInsightsKPIs | null {
  if (!metrics) return null;

  const withChange = (value: number | null | undefined, change: number | null | undefined): MetricWithChange => ({
    value: safeNumber(value),
    change: safeNumber(change),
  });

  return {
    prepaidRate: withChange(metrics.prepaidRate, metrics.changes.prepaidRate),
    repeatRate: withChange(metrics.repeatRate, metrics.changes.repeatRate),
    rtoRevenueLoss: withChange(metrics.rtoRevenueLoss, metrics.changes.rtoRevenueLoss),
    abandonedCustomers: withChange(
      metrics.abandonedCustomers,
      metrics.changes.abandonedCustomers,
    ),
    fulfillmentRate: withChange(
      metrics.fulfillmentRate,
      metrics.changes.fulfillmentRate,
    ),
  };
}

function computeCancelRate(metrics: OrdersOverviewMetrics | null): number {
  if (!metrics || metrics.totalOrders <= 0) {
    return 0;
  }
  const cancelled = safeNumber(metrics.cancelledOrders);
  return metrics.totalOrders > 0 ? (cancelled / metrics.totalOrders) * 100 : 0;
}

function computeFulfillmentMetricsFromOverview(
  dailyOverview: DailyMetricsOverview | null,
): OrdersFulfillmentMetrics {
  if (!dailyOverview) {
    return { ...ZERO_FULFILLMENT_METRICS };
  }

  const aggregates = dailyOverview.aggregates;
  const totalOrders =
    dailyOverview.ordersOverview?.totalOrders ??
    aggregates.orders ??
    0;
  const fulfillmentRate =
    dailyOverview.ordersOverview?.fulfillmentRate ?? 0;
  const returnRate =
    aggregates.orders > 0
      ? (aggregates.returnedOrders / aggregates.orders) * 100
      : 0;
  const totalFulfillmentCost =
    aggregates.shippingCosts + aggregates.handlingFees;
  const avgFulfillmentCost =
    aggregates.orders > 0
      ? totalFulfillmentCost / aggregates.orders
      : 0;

  return {
    avgProcessingTime: 0,
    avgShippingTime: 0,
    avgDeliveryTime: 0,
    onTimeDeliveryRate: fulfillmentRate,
    fulfillmentAccuracy: fulfillmentRate,
    returnRate,
    avgFulfillmentCost,
    totalOrders,
  };
}

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
  prepaidRate: v.number(),
  repeatRate: v.number(),
  rtoRevenueLoss: v.number(),
  abandonedCustomers: v.number(),
  changes: v.object({
    totalOrders: v.number(),
    revenue: v.number(),
    netProfit: v.number(),
    avgOrderValue: v.number(),
    cac: v.number(),
    margin: v.number(),
    fulfillmentRate: v.number(),
    prepaidRate: v.number(),
    repeatRate: v.number(),
    rtoRevenueLoss: v.number(),
    abandonedCustomers: v.number(),
  }),
});

const customerJourneyStageValidator = v.object({
  stage: v.string(),
  customers: v.number(),
  percentage: v.number(),
  avgDays: v.number(),
  conversionRate: v.number(),
  icon: v.string(),
  color: v.string(),
  metaConversionRate: v.optional(v.number()),
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

const metricWithChangeValidator = v.object({
  value: v.number(),
  change: v.number(),
});

const ordersInsightsKpisValidator = v.object({
  prepaidRate: metricWithChangeValidator,
  repeatRate: metricWithChangeValidator,
  rtoRevenueLoss: metricWithChangeValidator,
  abandonedCustomers: metricWithChangeValidator,
  fulfillmentRate: metricWithChangeValidator,
});

const ordersInsightsResponseValidator = v.object({
  kpis: v.union(v.null(), ordersInsightsKpisValidator),
  fulfillment: v.union(v.null(), fulfillmentMetricsValidator),
  journey: v.array(customerJourneyStageValidator),
  cancelRate: v.number(),
  returnRate: v.number(),
});

const ordersAnalyticsExportRowValidator = v.object({
  orderNumber: v.string(),
  customerEmail: v.string(),
  email: v.string(),
  status: v.string(),
  fulfillmentStatus: v.string(),
  financialStatus: v.string(),
  items: v.number(),
  revenue: v.number(),
  costs: v.number(),
  profit: v.number(),
  profitMargin: v.number(),
  shipping: v.number(),
  tax: v.number(),
  payment: v.string(),
  shipTo: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

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

const ordersAnalyticsResponseValidator = v.object({
  overview: v.union(v.null(), ordersOverviewValidator),
  fulfillment: fulfillmentMetricsValidator,
  orders: v.object({
    data: v.array(analyticsOrderValidator),
    pagination: v.object({
      page: v.number(),
      pageSize: v.number(),
      total: v.number(),
      totalPages: v.number(),
      estimatedTotal: v.number(),
      hasMore: v.boolean(),
    }),
  }),
  exportRows: v.array(ordersAnalyticsExportRowValidator),
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

export const getOrdersAnalytics = query({
  args: {
    dateRange: dateRangeValidator,
    status: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  returns: ordersAnalyticsResponseValidator,
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        overview: null,
        fulfillment: { ...ZERO_FULFILLMENT_METRICS },
        orders: {
          data: [],
          pagination: {
            page: 1,
            pageSize: DEFAULT_ORDERS_PAGE_SIZE,
            total: 0,
            totalPages: 1,
            estimatedTotal: 0,
            hasMore: false,
          },
        },
        exportRows: [],
      };
    }

    const range = validateDateRange(args.dateRange);
    const requestedPage = Math.max(1, args.page ?? 1);
    const requestedSize = args.pageSize ?? DEFAULT_ORDERS_PAGE_SIZE;
    const pageSize = Math.max(
      MIN_ORDERS_PAGE_SIZE,
      Math.min(requestedSize, MAX_ORDERS_PAGE_SIZE),
    );
    const desiredStartIndex = (requestedPage - 1) * pageSize;

    const overviewPromise = loadOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    let chunkCursor: string | null = null;
    const collectedOrders: AnalyticsOrder[] = [];
    const requestedFetch = pageSize * ORDERS_FETCH_MULTIPLIER;
    const fetchSize = Math.min(
      Math.max(requestedFetch, DEFAULT_ORDERS_PAGE_SIZE),
      MAX_ORDERS_FETCH_SIZE,
    );
    const targetOrderCount = Math.max(
      desiredStartIndex + pageSize,
      desiredStartIndex + fetchSize,
    );
    const seenCursors = new Set<string>();
    let reachedEnd = false;
    let truncated = false;

    while (true) {
      const chunk = await fetchAnalyticsOrderChunk(
        ctx,
        auth.orgId as Id<"organizations">,
        range,
        {
          cursor: chunkCursor ?? undefined,
          pageSize: fetchSize,
          datasets: ORDER_ANALYTICS_DATASETS,
        },
      );

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
        pageSize: fetchSize,
      });

      const chunkOrders = (computed.orders?.data ?? []).map(stripLineItems);
      if (chunkOrders.length > 0) {
        collectedOrders.push(...chunkOrders);
      }

      const nextCursor = chunk.cursor ?? null;

      if (!nextCursor || chunk.isDone) {
        reachedEnd = true;
        break;
      }

      if (collectedOrders.length >= targetOrderCount) {
        truncated = true;
        break;
      }

      if (seenCursors.has(nextCursor)) {
        truncated = true;
        break;
      }

      seenCursors.add(nextCursor);
      chunkCursor = nextCursor;
    }

    const sortedOrders = sortAnalyticsOrders(
      collectedOrders,
      args.sortBy ?? undefined,
      args.sortOrder ?? "desc",
    );
    const totalMatches = sortedOrders.length;
    const boundedStartIndex = Math.min(desiredStartIndex, totalMatches);
    const pageOrders = sortedOrders.slice(boundedStartIndex, boundedStartIndex + pageSize);
    const processedEndIndex = boundedStartIndex + pageOrders.length;
    const hitDataLimit = truncated && !reachedEnd;
    const hasMoreMatches = hitDataLimit || totalMatches > processedEndIndex;

    const overviewResult = await overviewPromise;
    const overview = overviewResult?.ordersOverview ?? ZERO_ORDERS_OVERVIEW;
    const fulfillmentMetrics = overviewResult
      ? computeFulfillmentMetricsFromOverview(overviewResult)
      : { ...ZERO_FULFILLMENT_METRICS };

    const knownTotal = reachedEnd
      ? totalMatches
      : Math.max(totalMatches, desiredStartIndex + pageOrders.length);
    const estimatedTotal = hasMoreMatches
      ? Math.max(
          knownTotal + (pageOrders.length === pageSize ? pageSize : 0),
          desiredStartIndex + pageOrders.length + pageSize,
        )
      : knownTotal;
    const totalForPaging = Math.max(knownTotal, estimatedTotal);
    const totalPages = Math.max(1, Math.ceil(totalForPaging / pageSize));

    const resolvedPage = pageOrders.length > 0
      ? Math.min(requestedPage, totalPages)
      : Math.min(Math.max(1, Math.ceil(totalForPaging / Math.max(pageSize, 1))), totalPages);

    const exportRows = pageOrders.map((order) => ({
      orderNumber: order.orderNumber,
      customerEmail: order.customer.email,
      email: order.customer.email,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      financialStatus: order.financialStatus,
      items: order.items,
      revenue: order.totalPrice,
      costs: order.totalCost,
      profit: order.profit,
      profitMargin: order.profitMargin,
      shipping: order.shippingCost,
      tax: order.taxAmount,
      payment: order.paymentMethod,
      shipTo: `${order.shippingAddress.city}, ${order.shippingAddress.country}`.trim(),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return {
      overview,
      fulfillment: fulfillmentMetrics,
      orders: {
        data: pageOrders,
        pagination: {
          page: resolvedPage,
          pageSize,
          total: totalForPaging,
          totalPages,
          estimatedTotal,
          hasMore: hasMoreMatches || (hitDataLimit && pageOrders.length === pageSize),
        },
      },
      exportRows,
    };
  },
});


export const getOrdersInsights = query({
  args: {
    dateRange: dateRangeValidator,
  },
  returns: ordersInsightsResponseValidator,
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        kpis: null,
        fulfillment: null,
        journey: [...DEFAULT_JOURNEY_STAGES],
        cancelRate: 0,
        returnRate: 0,
      } satisfies OrdersInsightsPayload;
    }

    const range = validateDateRange(args.dateRange);

    const [dailyOverview, journey] = await Promise.all([
      loadOverviewFromDailyMetrics(
        ctx,
        auth.orgId as Id<"organizations">,
        range,
      ),
      loadCustomerJourneyStages(
        ctx,
        auth.orgId as Id<"organizations">,
        range,
      ),
    ]);

    const metrics = dailyOverview?.ordersOverview ?? null;
    const fulfillmentMetrics = dailyOverview
      ? computeFulfillmentMetricsFromOverview(dailyOverview)
      : { ...ZERO_FULFILLMENT_METRICS };

    const kpis = buildInsightsKpis(metrics);
    const cancelRate = computeCancelRate(metrics);
    const returnRate = safeNumber(fulfillmentMetrics.returnRate);

    return {
      kpis,
      fulfillment: fulfillmentMetrics,
      journey,
      cancelRate,
      returnRate,
    } satisfies OrdersInsightsPayload;
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
