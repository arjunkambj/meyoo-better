import { v } from "convex/values";
import type { Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import {
  ANALYTICS_SOURCE_KEYS,
  type AnalyticsSourceKey,
  type DateRange,
  fetchAnalyticsOrderChunk,
  fetchGlobalCostsPage,
  fetchMetaInsightsPage,
  fetchSessionsPage,
  fetchShopifyAnalyticsPage,
  toTimestampRange,
  validateDateRange,
} from "../utils/analyticsSource";
import { computeOverviewMetrics, computePlatformMetrics } from "../utils/analyticsAggregations";
import { msToDateString, normalizeDateString } from "../utils/date";
import { loadAnalyticsWithChunks } from "../utils/analyticsLoader";
import type { AnalyticsResponse } from "../web/analyticsShared";

const datasetCountValidator = v.object({
  orders: v.number(),
  orderItems: v.number(),
  transactions: v.number(),
  refunds: v.number(),
  fulfillments: v.number(),
  customers: v.number(),
  products: v.number(),
  variants: v.number(),
  metaInsights: v.number(),
  globalCosts: v.number(),
  variantCosts: v.number(),
  sessions: v.number(),
  analytics: v.number(),
});

type DatasetCounts = Infer<typeof datasetCountValidator>;

const DAILY_METRICS_DATASETS = [
  "orders",
  "orderItems",
  "transactions",
  "refunds",
  "customers",
  "variants",
  "variantCosts",
  "globalCosts",
  "metaInsights",
  "analytics",
] as const satisfies readonly AnalyticsSourceKey[];

function resolveDateRange(
  input?: {
    startDate?: string;
    endDate?: string;
    daysBack?: number;
  },
): DateRange {
  if (input?.startDate && input?.endDate) {
    return validateDateRange({
      startDate: input.startDate,
      endDate: input.endDate,
    });
  }

  const endDate = input?.endDate ?? new Date().toISOString().substring(0, 10);
  const dayMs = 24 * 60 * 60 * 1000;
  const daysBack = Math.max(1, input?.daysBack ?? 30);
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  const startDate = input?.startDate
    ? input.startDate
    : new Date(end - daysBack * dayMs).toISOString().substring(0, 10);

  return validateDateRange({ startDate, endDate });
}

export const calculateAnalytics = internalAction({
  args: {
    organizationId: v.string(),
    calculateProfits: v.optional(v.boolean()),
    hasHistoricalCosts: v.optional(v.boolean()),
    syncType: v.optional(v.union(v.literal("initial"), v.literal("incremental"))),
    dateRange: v.optional(
      v.object({
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        daysBack: v.optional(v.number()),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    duration: v.number(),
    datasetCounts: datasetCountValidator,
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; duration: number; datasetCounts: DatasetCounts }> => {
    const startedAt = Date.now();
    const range = resolveDateRange(args.dateRange);
    const organizationId = args.organizationId;

    const counts: DatasetCounts = {
      orders: 0,
      orderItems: 0,
      transactions: 0,
      refunds: 0,
      fulfillments: 0,
      customers: 0,
      products: 0,
      variants: 0,
      metaInsights: 0,
      globalCosts: 0,
      variantCosts: 0,
      sessions: 0,
      analytics: 0,
    };

    const customerIds = new Set<string>();
    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    const productCostComponentIds = new Set<string>();

    let orderCursor: string | null = null;

    while (true) {
      const chunkArgs: {
        organizationId: string;
        startDate: string;
        endDate: string;
        cursor?: string;
      } = {
        organizationId,
        startDate: range.startDate,
        endDate: range.endDate,
      };

      if (orderCursor) {
        chunkArgs.cursor = orderCursor;
      }

      const chunk = await ctx.runQuery(
        internal.engine.analytics.gatherAnalyticsOrderChunk,
        chunkArgs,
      );

      counts.orders += chunk.orders.length;
      counts.orderItems += chunk.orderItems.length;
      counts.transactions += chunk.transactions.length;
      counts.refunds += chunk.refunds.length;
      counts.fulfillments += chunk.fulfillments.length;

      for (const customer of chunk.customers) {
        customerIds.add(customer._id as string);
      }
      for (const product of chunk.products) {
        productIds.add(product._id as string);
      }
      for (const variant of chunk.variants) {
        variantIds.add(variant._id as string);
      }
      for (const component of chunk.variantCosts) {
        productCostComponentIds.add(component._id as string);
      }

      if (chunk.isDone) {
        orderCursor = null;
        break;
      }

      orderCursor = chunk.cursor ?? null;

      if (orderCursor === null) {
        break;
      }
    }

    counts.customers = customerIds.size;
    counts.products = productIds.size;
    counts.variants = variantIds.size;
    counts.variantCosts = productCostComponentIds.size;

    const accumulateSupplementalCounts = async (
      dataset: "metaInsights" | "globalCosts" | "sessions" | "analytics",
    ) => {
      let cursor: string | null = null;
      let total = 0;

      while (true) {
        const pageArgs: {
          organizationId: string;
          startDate: string;
          endDate: string;
          dataset: "metaInsights" | "globalCosts" | "sessions" | "analytics";
          cursor?: string;
        } = {
          organizationId,
          startDate: range.startDate,
          endDate: range.endDate,
          dataset,
        };

        if (cursor) {
          pageArgs.cursor = cursor;
        }

        const page = await ctx.runQuery(
          internal.engine.analytics.gatherSupplementalAnalyticsChunk,
          pageArgs,
        );

        total += page.items.length;

        if (page.isDone) {
          return total;
        }

        cursor = page.cursor ?? null;

        if (cursor === null) {
          return total;
        }
      }
    };

    const [metaInsightCount, costCount, sessionCount, analyticsCount] = await Promise.all([
      accumulateSupplementalCounts("metaInsights"),
      accumulateSupplementalCounts("globalCosts"),
      accumulateSupplementalCounts("sessions"),
      accumulateSupplementalCounts("analytics"),
    ]);

    counts.metaInsights = metaInsightCount;
    counts.globalCosts = costCount;
    counts.sessions = sessionCount;
    counts.analytics = analyticsCount;

    return {
      success: true,
      duration: Date.now() - startedAt,
      datasetCounts: counts,
    };
  },
});

const supplementalDatasetValidator = v.union(
  v.literal("metaInsights"),
  v.literal("globalCosts"),
  v.literal("sessions"),
  v.literal("analytics"),
);

export const gatherAnalyticsOrderChunk = internalQuery({
  args: {
    organizationId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
    datasets: v.optional(v.array(v.string())),
  },
  returns: v.object({
    orders: v.array(v.any()),
    orderItems: v.array(v.any()),
    transactions: v.array(v.any()),
    refunds: v.array(v.any()),
    fulfillments: v.array(v.any()),
    products: v.array(v.any()),
    variants: v.array(v.any()),
    customers: v.array(v.any()),
    variantCosts: v.array(v.any()),
    cursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const range = validateDateRange({
      startDate: args.startDate,
      endDate: args.endDate,
    });

    const organizationId = args.organizationId as Id<"organizations">;
    const datasetKeys = args.datasets
      ? args.datasets.filter((key): key is AnalyticsSourceKey =>
          (ANALYTICS_SOURCE_KEYS as ReadonlyArray<string>).includes(key),
        )
      : undefined;
    const { data, cursor, isDone } = await fetchAnalyticsOrderChunk(
      ctx,
      organizationId,
      range,
      {
        cursor: args.cursor ?? null,
        pageSize: args.pageSize,
        datasets: datasetKeys,
      },
    );

    return {
      ...data,
      cursor: cursor ?? undefined,
      isDone,
    };
  },
});

export const gatherSupplementalAnalyticsChunk = internalQuery({
  args: {
    organizationId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    dataset: supplementalDatasetValidator,
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(v.any()),
    cursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const range = validateDateRange({
      startDate: args.startDate,
      endDate: args.endDate,
    });

    const organizationId = args.organizationId as Id<"organizations">;
    const timestamps = toTimestampRange(range);

    switch (args.dataset) {
      case "metaInsights": {
        const result = await fetchMetaInsightsPage(ctx, organizationId, range, {
          cursor: args.cursor ?? null,
          pageSize: args.pageSize,
        });
        return {
          items: result.docs,
          cursor: result.cursor ?? undefined,
          isDone: result.isDone,
        };
      }
      case "globalCosts": {
        const result = await fetchGlobalCostsPage(ctx, organizationId, timestamps, {
          cursor: args.cursor ?? null,
          pageSize: args.pageSize,
        });
        return {
          items: result.docs,
          cursor: result.cursor ?? undefined,
          isDone: result.isDone,
        };
      }
      case "sessions": {
        const result = await fetchSessionsPage(ctx, organizationId, timestamps, {
          cursor: args.cursor ?? null,
          pageSize: args.pageSize,
        });
        return {
          items: result.docs,
          cursor: result.cursor ?? undefined,
          isDone: result.isDone,
        };
      }
      case "analytics": {
        const result = await fetchShopifyAnalyticsPage(ctx, organizationId, range, {
          cursor: args.cursor ?? null,
          pageSize: args.pageSize,
        });
        return {
          items: result.docs,
          cursor: result.cursor ?? undefined,
          isDone: result.isDone,
        };
      }
      default: {
        throw new Error(`Unsupported dataset: ${args.dataset}`);
      }
    }
  },
});

export const getAvailableDateBounds = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    earliest: v.optional(v.string()),
    latest: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const earliestCandidates: string[] = [];
    const latestCandidates: string[] = [];

    const addEarliestMs = (value: number | null | undefined) => {
      const normalized = msToDateString(value ?? null);
      if (normalized) {
        earliestCandidates.push(normalized);
      }
    };

    const addLatestMs = (value: number | null | undefined) => {
      const normalized = msToDateString(value ?? null);
      if (normalized) {
        latestCandidates.push(normalized);
      }
    };

    const addEarliestString = (value: string | null | undefined) => {
      if (!value) return;
      try {
        earliestCandidates.push(normalizeDateString(value));
      } catch (_error) {
        // ignore invalid dates
      }
    };

    const addLatestString = (value: string | null | undefined) => {
      if (!value) return;
      try {
        latestCandidates.push(normalizeDateString(value));
      } catch (_error) {
        // ignore invalid dates
      }
    };

    const earliestOrder = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("asc")
      .first();
    if (earliestOrder) {
      addEarliestMs(earliestOrder.shopifyCreatedAt);
    }

    const latestOrder = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();
    if (latestOrder) {
      addLatestMs(latestOrder.shopifyCreatedAt);
    }

    const earliestTransaction = await ctx.db
      .query("shopifyTransactions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("asc")
      .first();
    if (earliestTransaction) {
      addEarliestMs(earliestTransaction.shopifyCreatedAt);
      addEarliestMs(earliestTransaction.processedAt ?? null);
    }

    const latestTransaction = await ctx.db
      .query("shopifyTransactions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();
    if (latestTransaction) {
      addLatestMs(latestTransaction.shopifyCreatedAt);
      addLatestMs(latestTransaction.processedAt ?? null);
    }

    const earliestRefund = await ctx.db
      .query("shopifyRefunds")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("asc")
      .first();
    if (earliestRefund) {
      addEarliestMs(earliestRefund.shopifyCreatedAt);
      addEarliestMs(earliestRefund.processedAt ?? null);
    }

    const latestRefund = await ctx.db
      .query("shopifyRefunds")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();
    if (latestRefund) {
      addLatestMs(latestRefund.shopifyCreatedAt);
      addLatestMs(latestRefund.processedAt ?? null);
    }

    const earliestInsight = await ctx.db
      .query("metaInsights")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("asc")
      .first();
    if (earliestInsight) {
      addEarliestString(earliestInsight.date);
    }

    const latestInsight = await ctx.db
      .query("metaInsights")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();
    if (latestInsight) {
      addLatestString(latestInsight.date);
    }

    const earliestCost = await ctx.db
      .query("globalCosts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("asc")
      .first();
    if (earliestCost) {
      addEarliestMs(earliestCost.effectiveFrom);
    }

    const latestCost = await ctx.db
      .query("globalCosts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();
    if (latestCost) {
      addLatestMs(latestCost.effectiveFrom);
    }

    const earliestMetric = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_organization_date", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("asc")
      .first();
    if (earliestMetric) {
      addEarliestString(earliestMetric.date);
    }

    const latestMetric = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_organization_date", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();
    if (latestMetric) {
      addLatestString(latestMetric.date);
    }

    const sortedEarliest = earliestCandidates.sort();
    const sortedLatest = latestCandidates.sort();

    return {
      earliest: sortedEarliest[0],
      latest: sortedLatest[sortedLatest.length - 1],
    };
  },
});

export const updateOrderMetrics = internalAction({
  args: {
    organizationId: v.string(),
    orderId: v.optional(v.string()),
    eventType: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async () => {
    return { success: true };
  },
});

export const updateCustomerMetrics = internalAction({
  args: {
    organizationId: v.string(),
    customerId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async () => {
    return { success: true };
  },
});

export const updateProductMetrics = internalAction({
  args: {
    organizationId: v.string(),
    productId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async () => {
    return { success: true };
  },
});

type GenericRecord = Record<string, any>;

function toSafeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function toStringId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function classifyPaymentMethod(order: GenericRecord, transactions: GenericRecord[]): "prepaid" | "cod" | "other" {
  const financialStatus = String(
    order.financialStatus ?? order.financial_status ?? "",
  ).toLowerCase();

  const primaryTx = transactions.find((tx) => String(tx.kind).toLowerCase() === "sale")
    ?? transactions[0];
  const rawGateway = String(
    primaryTx?.gateway ?? order.gateway ?? order.paymentGateway,
  ).toLowerCase();

  const gateway = rawGateway.trim();

  if (gateway.includes("cash_on_delivery") || gateway.includes("cash-on-delivery")) {
    return "cod";
  }

  if (gateway.includes("cash") && gateway.includes("delivery")) {
    return "cod";
  }

  if (gateway.includes("cod")) {
    return "cod";
  }

  if (gateway.includes("manual") || gateway.includes("test")) {
    return "other";
  }

  if (financialStatus.includes("pending") || financialStatus.includes("authorized")) {
    return "other";
  }

  return "prepaid";
}

function sanitizeDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function buildDailyMetricsFromResponse(
  response: AnalyticsResponse,
): DailyMetricsPayload {
  const overview = computeOverviewMetrics(response);
  const platformMetrics = computePlatformMetrics(response);
  const summary = overview?.summary;

  const orders = (response.data.orders ?? []) as GenericRecord[];
  const transactions = (response.data.transactions ?? []) as GenericRecord[];
  const refunds = (response.data.refunds ?? []) as GenericRecord[];
  const orderItems = (response.data.orderItems ?? []) as GenericRecord[];

  const transactionsByOrder = new Map<string, GenericRecord[]>();
  for (const transaction of transactions) {
    const orderKey = toStringId(
      transaction.orderId ?? transaction.order_id ?? transaction.shopifyOrderId,
    );
    if (!orderKey) continue;
    const bucket = transactionsByOrder.get(orderKey) ?? [];
    bucket.push(transaction);
    transactionsByOrder.set(orderKey, bucket);
  }

  let prepaidOrders = 0;
  let codOrders = 0;
  let otherOrders = 0;
  let cancelledOrders = 0;

  const ordersPerCustomer = new Map<string, number>();

  const isCancelledOrder = (order: GenericRecord): boolean => {
    const candidates = [
      order.status,
      order.financialStatus,
      order.fulfillmentStatus,
      order.financial_status,
      order.fulfillment_status,
    ];

    return candidates.some((value) => {
      if (!value) return false;
      const normalized = String(value).toLowerCase();
      return (
        normalized.includes("cancel") ||
        normalized.includes("void") ||
        normalized.includes("decline")
      );
    });
  };

  for (const order of orders) {
    const orderKey = toStringId(order._id ?? order.id ?? order.orderId ?? order.shopifyId);
    const txs = transactionsByOrder.get(orderKey) ?? [];
    const classification = classifyPaymentMethod(order, txs);
    switch (classification) {
      case "cod":
        codOrders += 1;
        break;
      case "other":
        otherOrders += 1;
        break;
      default:
        prepaidOrders += 1;
        break;
    }

    if (isCancelledOrder(order)) {
      cancelledOrders += 1;
    }

    const customerKey = order.customerId ? String(order.customerId) : undefined;
    if (customerKey) {
      ordersPerCustomer.set(
        customerKey,
        (ordersPerCustomer.get(customerKey) ?? 0) + 1,
      );
    }
  }

  const paymentBreakdown = prepaidOrders + codOrders + otherOrders > 0
    ? sanitizeDocument({
        prepaidOrders: prepaidOrders || undefined,
        codOrders: codOrders || undefined,
        otherOrders: otherOrders || undefined,
      })
    : null;

  const newCustomers = toSafeNumber(summary?.newCustomers);
  const returningCustomers = toSafeNumber(summary?.returningCustomers);
  const repeatCustomers = Array.from(ordersPerCustomer.values()).reduce(
    (count, occurrences) => (occurrences > 1 ? count + 1 : count),
    0,
  );
  const customerBreakdown = newCustomers + returningCustomers + repeatCustomers > 0
    ? sanitizeDocument({
        newCustomers: newCustomers || undefined,
        returningCustomers: returningCustomers || undefined,
        repeatCustomers: repeatCustomers || undefined,
      })
    : null;

  const returnedOrders = (() => {
    if (!refunds.length) return 0;
    const withReturns = new Set<string>();
    for (const refund of refunds) {
      const key = toStringId(
        refund.orderId ?? refund.shopifyOrderId ?? refund.shopify_order_id,
      );
      if (key) {
        withReturns.add(key);
      }
    }
    return withReturns.size;
  })();

  const uniqueCustomers = ordersPerCustomer.size > 0
    ? ordersPerCustomer.size
    : toSafeNumber(summary?.customers);

  // Calculate units sold from order items
  let unitsSold = 0;
  for (const item of orderItems) {
    const orderKey = toStringId(
      item.orderId ?? item.order_id ?? item.order ?? item.shopifyOrderId,
    );
    // Skip cancelled orders
    const order = orders.find(o => toStringId(o._id ?? o.id ?? o.orderId ?? o.shopifyId) === orderKey);
    if (order && !isCancelledOrder(order)) {
      unitsSold += toSafeNumber(item.quantity);
    }
  }

  // If no order items, fall back to summary
  if (unitsSold === 0) {
    unitsSold = toSafeNumber(summary?.unitsSold);
  }

  const metrics = sanitizeDocument({
    totalOrders: toSafeNumber(summary?.orders),
    totalRevenue: toSafeNumber(summary?.revenue),
    uniqueCustomers,
    totalCustomers: ordersPerCustomer.size, // Total customers who made purchases
    unitsSold, // Total units sold that day
    totalCogs: toSafeNumber(summary?.cogs),
    totalHandlingFee: toSafeNumber(summary?.handlingFees),
    totalShippingCost: toSafeNumber(summary?.shippingCosts),
    totalTransactionFees: toSafeNumber(summary?.transactionFees),
    totalMarketingCost: toSafeNumber(summary?.totalAdSpend ?? summary?.adSpend),
    dailyOperatingCost: toSafeNumber(summary?.customCosts),
    totalTaxes: toSafeNumber(summary?.taxesCollected),
    blendedRoas: toSafeNumber(summary?.roas),
    blendedCtr: toSafeNumber(platformMetrics.blendedCTR),
    blendedMarketingCost: toSafeNumber(summary?.totalAdSpend ?? summary?.adSpend),
    cancelledOrders,
    returnedOrders,
  });

  return {
    ...metrics,
    paymentBreakdown: paymentBreakdown ?? undefined,
    customerBreakdown: customerBreakdown ?? undefined,
  } as DailyMetricsPayload;
}

const dailyMetricsPayload = v.object({
  totalOrders: v.optional(v.number()),
  totalRevenue: v.optional(v.number()),
  uniqueCustomers: v.optional(v.number()),
  totalCustomers: v.optional(v.number()),
  unitsSold: v.optional(v.number()),
  totalCogs: v.optional(v.number()),
  totalHandlingFee: v.optional(v.number()),
  totalShippingCost: v.optional(v.number()),
  totalTransactionFees: v.optional(v.number()),
  totalMarketingCost: v.optional(v.number()),
  dailyOperatingCost: v.optional(v.number()),
  totalTaxes: v.optional(v.number()),
  blendedRoas: v.optional(v.number()),
  blendedCtr: v.optional(v.number()),
  blendedMarketingCost: v.optional(v.number()),
  cancelledOrders: v.optional(v.number()),
  returnedOrders: v.optional(v.number()),
  paymentBreakdown: v.optional(
    v.object({
      prepaidOrders: v.optional(v.number()),
      codOrders: v.optional(v.number()),
      otherOrders: v.optional(v.number()),
    }),
  ),
  customerBreakdown: v.optional(
    v.object({
      newCustomers: v.optional(v.number()),
      returningCustomers: v.optional(v.number()),
      repeatCustomers: v.optional(v.number()),
    }),
  ),
});

type DailyMetricsPayload = Infer<typeof dailyMetricsPayload>;

export const upsertDailyMetric = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
    metrics: dailyMetricsPayload,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_organization_date", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("date", args.date),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args.metrics as any);
    } else {
      await ctx.db.insert("dailyMetrics", {
        organizationId: args.organizationId,
        date: args.date,
        ...args.metrics,
      } as any);
    }
  },
});

export const rebuildDailyMetrics = internalAction({
  args: {
    organizationId: v.id("organizations"),
    dates: v.array(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    const uniqueDates = Array.from(
      new Set(args.dates.map((date) => normalizeDateString(date))),
    );

    if (uniqueDates.length === 0) {
      return { processed: 0, updated: 0, skipped: 0 };
    }

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    for (const date of uniqueDates) {
      processed += 1;
      try {
        const normalizedDate = normalizeDateString(date);
        const { data } = await loadAnalyticsWithChunks(
          ctx,
          args.organizationId as Id<"organizations">,
          {
            startDate: normalizedDate,
            endDate: normalizedDate,
          },
          {
            datasets: DAILY_METRICS_DATASETS,
          },
        );

        const response: AnalyticsResponse = {
          dateRange: { startDate: normalizedDate, endDate: normalizedDate },
          organizationId: args.organizationId,
          data,
        };

        const metrics = buildDailyMetricsFromResponse(response);

        await ctx.runMutation(internal.engine.analytics.upsertDailyMetric, {
          organizationId: args.organizationId,
          date,
          metrics,
        });

        updated += 1;
      } catch (error) {
        skipped += 1;
        console.warn("[Analytics] Failed to rebuild daily metrics", {
          organizationId: args.organizationId,
          date,
          error,
        });
      }
    }

    return { processed, updated, skipped };
  },
});
