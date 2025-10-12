import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { action, query, type QueryCtx } from "../_generated/server";
import { dateRangeValidator, type AnalyticsResponse } from "./analyticsShared";
import {
  type AnalyticsSourceKey,
  type DateRange,
  validateDateRange,
  getRangeEndExclusiveMs,
  getRangeStartMs,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import {
  DEFAULT_JOURNEY_STAGES,
  loadCustomerJourneyStages,
} from "../utils/customerJourney";
import { computeOrdersAnalytics } from "../utils/analyticsAggregations";
import { deriveAnalyticsOrders } from "../utils/analytics/orders";
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
import type { AnalyticsSourceData } from "../utils/analyticsSource";

const ORDER_ANALYTICS_DATASETS = [
  "orders",
  "orderItems",
  "transactions",
  "refunds",
  "variantCosts",
] as const satisfies readonly AnalyticsSourceKey[];

const DEFAULT_ORDERS_PAGE_SIZE = 50;
const MAX_ORDERS_PAGE_SIZE = 50;
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
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return null;
  }

  const spanDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));

  return {
    startDate: shiftDateString(range.startDate, -spanDays),
    endDate: shiftDateString(range.startDate, -1),
  } satisfies DateRange;
}

function matchesStatusFilter(
  order: Doc<"shopifyOrders">,
  status: string,
): boolean {
  if (!status || status === "all") {
    return true;
  }

  const fulfillment = (order.fulfillmentStatus ?? "").toLowerCase();
  const financial = (order.financialStatus ?? "").toLowerCase();

  switch (status) {
    case "unfulfilled":
      return (
        fulfillment === "" ||
        fulfillment === "unfulfilled" ||
        fulfillment === "pending"
      );
    case "partial":
      return fulfillment.includes("partial");
    case "fulfilled":
      return (
        fulfillment.includes("fulfill") ||
        fulfillment.includes("delivered") ||
        fulfillment.includes("complete")
      );
    case "cancelled":
      return Boolean(order.cancelledAt) || financial.includes("cancel");
    case "refunded":
      return financial.includes("refund");
    default:
      return true;
  }
}

function matchesSearchFilter(
  order: Doc<"shopifyOrders">,
  customer: Doc<"shopifyCustomers"> | null | undefined,
  term: string | null,
): boolean {
  if (!term) {
    return true;
  }

  const normalized = term.toLowerCase();
  const fields: Array<string | undefined> = [
    order.orderNumber,
    order.name,
    order.email,
    customer?.email,
  ];

  if (customer) {
    fields.push(
      [customer.firstName ?? "", customer.lastName ?? ""].join(" ").trim(),
      customer.phone,
    );
  }

  const shipping = order.shippingAddress;
  if (shipping) {
    fields.push(
      shipping.city,
      shipping.province,
      shipping.country,
      shipping.zip,
    );
  }

  return fields.some((value) => {
    if (!value) return false;
    return value.toLowerCase().includes(normalized);
  });
}

function resolveCustomerName(
  order: Doc<"shopifyOrders">,
  customer: Doc<"shopifyCustomers"> | null | undefined,
): string {
  if (customer) {
    const fromNames = [customer.firstName ?? "", customer.lastName ?? ""]
      .join(" ")
      .trim();
    if (fromNames) {
      return fromNames;
    }
    if (customer.email && customer.email.trim().length > 0) {
      return customer.email.trim();
    }
  }

  if (order.shippingAddress) {
    const potential = [
      order.shippingAddress.city ?? "",
      order.shippingAddress.province ?? "",
      order.shippingAddress.country ?? "",
    ]
      .filter(Boolean)
      .join(", ");
    if (potential) {
      return potential;
    }
  }

  if (order.email && order.email.trim().length > 0) {
    return order.email.trim();
  }

  return "Guest Checkout";
}

function buildAnalyticsOrder(
  order: Doc<"shopifyOrders">,
  customer: Doc<"shopifyCustomers"> | null | undefined,
): AnalyticsOrder {
  const customerName = resolveCustomerName(order, customer);
  const customerEmail =
    customer?.email ??
    (order.email && order.email.trim().length > 0 ? order.email.trim() : "");

  const shipping = order.shippingAddress ?? {};
  const createdAtIso = new Date(order.shopifyCreatedAt).toISOString();
  const updatedAtIso = order.updatedAt
    ? new Date(order.updatedAt).toISOString()
    : createdAtIso;

  return {
    id: order._id,
    orderNumber: order.orderNumber ?? order.name ?? order.shopifyId,
    customer: {
      name: customerName,
      email: customerEmail,
    },
    status: order.financialStatus ?? "",
    fulfillmentStatus: order.fulfillmentStatus ?? "",
    financialStatus: order.financialStatus ?? "",
    items:
      typeof order.totalItems === "number"
        ? order.totalItems
        : typeof order.totalQuantity === "number"
          ? order.totalQuantity
          : 0,
    totalPrice: typeof order.totalPrice === "number" ? order.totalPrice : 0,
    totalCost: 0,
    profit: 0,
    profitMargin: 0,
    taxAmount: 0,
    shippingCost: 0,
    paymentMethod: order.financialStatus ?? "unknown",
    tags: Array.isArray(order.tags) ? order.tags : [],
    shippingAddress: {
      city: shipping.city ?? "",
      country: shipping.country ?? "",
    },
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
    lineItems: [],
  };
}

type OrderScopedTable =
  | "shopifyOrderItems"
  | "shopifyTransactions"
  | "shopifyRefunds";

const ORDER_SCOPE_CHUNK_SIZE = 25;

async function fetchOrderScopedDocs<T extends OrderScopedTable>(
  ctx: QueryCtx,
  table: T,
  orderIds: Array<Id<"shopifyOrders">>,
): Promise<Array<Doc<T>>> {
  if (orderIds.length === 0) {
    return [];
  }

  const collected: Doc<T>[] = [];

  for (let index = 0; index < orderIds.length; index += ORDER_SCOPE_CHUNK_SIZE) {
    const chunk = orderIds.slice(index, index + ORDER_SCOPE_CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map((orderId) =>
        ctx.db
          .query(table)
          .withIndex("by_order", (q: any) => q.eq("orderId", orderId))
          .collect(),
      ),
    );

    for (const docs of chunkResults) {
      collected.push(...docs);
    }
  }

  return collected;
}

async function fetchVariantCostsForItems(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  variantIds: ReadonlySet<Id<"shopifyProductVariants">>,
): Promise<Doc<"variantCosts">[]> {
  if (variantIds.size === 0) {
    return [];
  }

  const collected: Doc<"variantCosts">[] = [];
  const ids = Array.from(variantIds);

  for (let index = 0; index < ids.length; index += ORDER_SCOPE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + ORDER_SCOPE_CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map((variantId) =>
        ctx.db
          .query("variantCosts")
          .withIndex("by_org_variant", (q: any) =>
            q.eq("organizationId", orgId).eq("variantId", variantId),
          )
          .collect(),
      ),
    );

    for (const docs of chunkResults) {
      collected.push(...docs);
    }
  }

  return collected;
}

type OrderFinancialSnapshot = Pick<
  AnalyticsOrder,
  "totalCost" | "profit" | "profitMargin" | "taxAmount" | "shippingCost" | "lineItems"
>;

async function loadOrderFinancialSnapshots(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  orders: Doc<"shopifyOrders">[],
): Promise<Map<string, OrderFinancialSnapshot>> {
  if (orders.length === 0) {
    return new Map();
  }

  const orderIds = orders.map((order) => order._id as Id<"shopifyOrders">);

  const [orderItems, transactions, refunds] = await Promise.all([
    fetchOrderScopedDocs(ctx, "shopifyOrderItems", orderIds),
    fetchOrderScopedDocs(ctx, "shopifyTransactions", orderIds),
    fetchOrderScopedDocs(ctx, "shopifyRefunds", orderIds),
  ]);

  const variantIds = new Set<Id<"shopifyProductVariants">>();
  for (const item of orderItems) {
    if (item.variantId) {
      variantIds.add(item.variantId as Id<"shopifyProductVariants">);
    }
  }

  const variantCosts = await fetchVariantCostsForItems(ctx, orgId, variantIds);

  const dataset: AnalyticsSourceData = {
    orders,
    orderItems,
    transactions,
    refunds,
    fulfillments: [],
    products: [],
    variants: [],
    customers: [],
    metaInsights: [],
    globalCosts: [],
    variantCosts,
    manualReturnRates: [],
    sessions: [],
    analytics: [],
  };

  const { orders: analyticsOrders } = deriveAnalyticsOrders(dataset);
  const map = new Map<string, OrderFinancialSnapshot>();

  for (const order of analyticsOrders) {
    map.set(order.id, {
      totalCost: order.totalCost,
      profit: order.profit,
      profitMargin: order.profitMargin,
      taxAmount: order.taxAmount,
      shippingCost: order.shippingCost,
      lineItems: order.lineItems ?? [],
    });
  }

  return map;
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
  metrics: OrdersOverviewMetrics | null
): OrdersInsightsKPIs | null {
  if (!metrics) return null;

  const withChange = (
    value: number | null | undefined,
    change: number | null | undefined
  ): MetricWithChange => ({
    value: safeNumber(value),
    change: safeNumber(change),
  });

  return {
    prepaidRate: withChange(metrics.prepaidRate, metrics.changes.prepaidRate),
    repeatRate: withChange(metrics.repeatRate, metrics.changes.repeatRate),
    rtoRevenueLoss: withChange(
      metrics.rtoRevenueLoss,
      metrics.changes.rtoRevenueLoss
    ),
    abandonedCustomers: withChange(
      metrics.abandonedCustomers,
      metrics.changes.abandonedCustomers
    ),
    fulfillmentRate: withChange(
      metrics.fulfillmentRate,
      metrics.changes.fulfillmentRate
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
  dailyOverview: DailyMetricsOverview | null
): OrdersFulfillmentMetrics {
  if (!dailyOverview) {
    return { ...ZERO_FULFILLMENT_METRICS };
  }

  const aggregates = dailyOverview.aggregates;
  const totalOrders =
    dailyOverview.ordersOverview?.totalOrders ?? aggregates.orders ?? 0;
  const fulfillmentRate = dailyOverview.ordersOverview?.fulfillmentRate ?? 0;
  const returnRate =
    aggregates.orders > 0
      ? (aggregates.returnedOrders / aggregates.orders) * 100
      : 0;
  const totalFulfillmentCost =
    aggregates.shippingCosts + aggregates.handlingFees;
  const avgFulfillmentCost =
    aggregates.orders > 0 ? totalFulfillmentCost / aggregates.orders : 0;

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
      };
    }

    const range = validateDateRange(args.dateRange);
    const requestedPage = Math.max(1, args.page ?? 1);
    const requestedSize = args.pageSize ?? DEFAULT_ORDERS_PAGE_SIZE;
    const pageSize = Math.max(
      MIN_ORDERS_PAGE_SIZE,
      Math.min(requestedSize, MAX_ORDERS_PAGE_SIZE)
    );
    const desiredStartIndex = (requestedPage - 1) * pageSize;

    const overviewPromise = loadOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range
    );

    const rangeStartMs = getRangeStartMs(range);
    const rangeEndExclusiveMs = getRangeEndExclusiveMs(range);
    const normalizedStatus = (args.status ?? "all").toLowerCase();
    const normalizedSearch = args.searchTerm?.trim().toLowerCase() ?? null;

    const baseQuery = ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .gte("shopifyCreatedAt", rangeStartMs)
          .lte("shopifyCreatedAt", rangeEndExclusiveMs - 1)
      )
      .order("desc");

    const customerCache = new Map<string, Doc<"shopifyCustomers"> | null>();
    const matchedOrders: Doc<"shopifyOrders">[] = [];
    let cursor: string | null = null;
    let skipped = 0;
    let totalFiltered = 0;
    let hasMoreMatches = false;
    let lastPageIsDone = false;

    while (matchedOrders.length < pageSize) {
      const page = await baseQuery.paginate({ numItems: pageSize, cursor });
      lastPageIsDone = page.isDone;

      const customerIds: string[] = [];
      for (const order of page.page) {
        if (!order.customerId) {
          continue;
        }
        const id = order.customerId as string;
        if (customerCache.has(id) || customerIds.includes(id)) {
          continue;
        }
        customerIds.push(id);
      }

      if (customerIds.length > 0) {
        const customerDocs = await Promise.all(
          customerIds.map((id) => ctx.db.get(id as Id<"shopifyCustomers">)),
        );
        customerIds.forEach((id, index) => {
          customerCache.set(id, customerDocs[index] ?? null);
        });
      }

      const filtered = page.page.filter((order) => {
        const customerKey = order.customerId ? (order.customerId as string) : null;
        let customerDoc: Doc<"shopifyCustomers"> | null | undefined = null;
        if (customerKey) {
          customerDoc = customerCache.get(customerKey) ?? null;
        }
        if (!matchesStatusFilter(order, normalizedStatus)) {
          return false;
        }
        return matchesSearchFilter(order, customerDoc, normalizedSearch);
      });

      totalFiltered += filtered.length;

      for (let index = 0; index < filtered.length; index += 1) {
        const order = filtered[index]!;
        if (skipped < desiredStartIndex) {
          skipped += 1;
          continue;
        }

        matchedOrders.push(order);
        if (matchedOrders.length >= pageSize) {
          if (index < filtered.length - 1) {
            hasMoreMatches = true;
          }
          break;
        }
      }

      if (matchedOrders.length >= pageSize) {
        if (!page.isDone) {
          hasMoreMatches = true;
        }
        break;
      }

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor;
    }

    const overviewResult = await overviewPromise;
    const overview = overviewResult?.ordersOverview ?? ZERO_ORDERS_OVERVIEW;
    const fulfillmentMetrics = overviewResult
      ? computeFulfillmentMetricsFromOverview(overviewResult)
      : { ...ZERO_FULFILLMENT_METRICS };

    const financialSnapshots = await loadOrderFinancialSnapshots(
      ctx,
      auth.orgId as Id<"organizations">,
      matchedOrders,
    );

    const analyticsOrders = matchedOrders.map((order) => {
      const customerKey = order.customerId ? (order.customerId as string) : null;
      let customerDoc: Doc<"shopifyCustomers"> | null | undefined = null;
      if (customerKey) {
        customerDoc = customerCache.get(customerKey) ?? null;
      }
      const base = buildAnalyticsOrder(order, customerDoc);
      const snapshot = financialSnapshots.get(String(order._id));
      if (!snapshot) {
        return base;
      }

      return {
        ...base,
        totalCost: snapshot.totalCost,
        profit: snapshot.profit,
        profitMargin: snapshot.profitMargin,
        taxAmount: snapshot.taxAmount,
        shippingCost: snapshot.shippingCost,
        lineItems: snapshot.lineItems,
      };
    });

    const knownTotal = lastPageIsDone
      ? totalFiltered
      : desiredStartIndex + analyticsOrders.length;
    const estimatedTotal =
      hasMoreMatches || !lastPageIsDone
        ? knownTotal + pageSize
        : knownTotal;
    const totalPages = Math.max(1, Math.ceil(estimatedTotal / pageSize));
    const resolvedPage =
      analyticsOrders.length > 0
        ? Math.min(requestedPage, totalPages)
        : Math.min(
            Math.max(1, Math.ceil(knownTotal / Math.max(pageSize, 1))),
            totalPages
          );

    return {
      overview,
      fulfillment: fulfillmentMetrics,
      orders: {
        data: analyticsOrders,
        pagination: {
          page: resolvedPage,
          pageSize,
          total: knownTotal,
          totalPages,
          estimatedTotal,
          hasMore: hasMoreMatches || !lastPageIsDone,
        },
      },
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
        range
      ),
      loadCustomerJourneyStages(ctx, auth.orgId as Id<"organizations">, range),
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
  })
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
      }
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
        const { data: previousData, meta: previousMeta } =
          await loadAnalyticsWithChunks(
            ctx,
            auth.orgId as Id<"organizations">,
            previousRange,
            {
              datasets: ORDER_ANALYTICS_DATASETS,
            }
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

    const result = computeOrdersAnalytics(
      response,
      {
        status: args.status ?? undefined,
        searchTerm: args.searchTerm ?? undefined,
        sortBy: args.sortBy ?? undefined,
        sortOrder: args.sortOrder ?? undefined,
        page: args.page ?? undefined,
        pageSize: args.pageSize ?? undefined,
      },
      previousResponse ?? undefined
    );

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
