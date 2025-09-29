import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { action, query, type ActionCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  defaultDateRange,
  loadAnalytics,
  responseValidator,
  type AnalyticsResponse,
  type LoadAnalyticsOptions,
} from "./analyticsShared";
import {
  type AnalyticsSourceData,
  type AnalyticsSourceKey,
  type DateRange,
  validateDateRange,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { computeOrdersAnalytics } from "../utils/analyticsAggregations";
import type { OrdersAnalyticsResult } from "@repo/types";

const responseOrNull = v.union(v.null(), responseValidator);

type DateRangeArg = { startDate: string; endDate: string };

const ORDER_ANALYTICS_DATASETS = [
  "orders",
  "orderItems",
  "variants",
  "productCostComponents",
  "costs",
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

const DEFAULT_ORDER_CHUNK_SIZE = 20;
const MIN_ORDER_CHUNK_SIZE = 1;
const DEFAULT_SUPPLEMENTAL_CHUNK_SIZE = 200;
const MIN_SUPPLEMENTAL_CHUNK_SIZE = 25;

const analyticsActionReturns = v.union(
  v.null(),
  v.object({
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
    organizationId: v.string(),
    result: v.optional(v.any()),
  }),
);

function isTooManyReadsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("Too many reads");
}

function shouldFetchDataset(
  requested: ReadonlySet<AnalyticsSourceKey> | null,
  key: AnalyticsSourceKey,
): boolean {
  return requested ? requested.has(key) : true;
}

async function loadOrdersAnalyticsAction(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
  options?: LoadAnalyticsOptions,
): Promise<{ data: AnalyticsSourceData; meta?: Record<string, unknown> }> {
  const requested = options?.datasets ? new Set(options.datasets) : null;
  const shouldFetch = (key: AnalyticsSourceKey) => shouldFetchDataset(requested, key);

  const data: AnalyticsSourceData = {
    orders: [],
    orderItems: [],
    transactions: [],
    refunds: [],
    fulfillments: [],
    products: [],
    variants: [],
    customers: [],
    metaInsights: [],
    costs: [],
    productCostComponents: [],
    sessions: [],
    analytics: [],
  };

  const meta: Record<string, unknown> = {};

  const uniqueCustomers = new Map<string, Doc<"shopifyCustomers">>();
  const uniqueProducts = new Map<string, Doc<"shopifyProducts">>();
  const uniqueVariants = new Map<string, Doc<"shopifyProductVariants">>();
  const uniqueProductCostComponents = new Map<string, Doc<"productCostComponents">>();
  const uniqueMetaInsights = new Map<string, Doc<"metaInsights">>();
  const uniqueCosts = new Map<string, Doc<"costs">>();
  const uniqueSessions = new Map<string, Doc<"shopifySessions">>();
  const uniqueAnalytics = new Map<string, Doc<"shopifyAnalytics">>();

  const baseArgs = {
    organizationId: organizationId as string,
    startDate: range.startDate,
    endDate: range.endDate,
  };

  let orderCursor: string | null = null;
  let orderChunkSize = DEFAULT_ORDER_CHUNK_SIZE;
  const maxOrders = options?.limits?.maxOrders;
  let remainingOrders = typeof maxOrders === "number" && maxOrders > 0 ? maxOrders : null;
  let reducedOrderChunk = false;

  while (true) {
    if (remainingOrders !== null && remainingOrders <= 0) {
      meta.truncatedOrders = true;
      break;
    }

    const effectiveChunkSize = remainingOrders !== null
      ? Math.max(MIN_ORDER_CHUNK_SIZE, Math.min(orderChunkSize, remainingOrders))
      : orderChunkSize;

    const chunkArgs = {
      ...baseArgs,
      pageSize: effectiveChunkSize,
      ...(orderCursor ? { cursor: orderCursor } : {}),
      ...(requested ? { datasets: Array.from(requested) } : {}),
    } as const;

    let chunk: any;
    while (true) {
      try {
        chunk = await ctx.runQuery(
          internal.engine.analytics.gatherAnalyticsOrderChunk,
          chunkArgs,
        );
        break;
      } catch (error) {
        if (isTooManyReadsError(error) && orderChunkSize > MIN_ORDER_CHUNK_SIZE) {
          orderChunkSize = Math.max(MIN_ORDER_CHUNK_SIZE, Math.floor(orderChunkSize / 2));
          reducedOrderChunk = true;
          continue;
        }
        throw error;
      }
    }

    if (shouldFetch("orders")) {
      data.orders.push(...chunk.orders);
    }
    if (shouldFetch("orderItems")) {
      data.orderItems.push(...chunk.orderItems);
    }
    if (shouldFetch("transactions")) {
      data.transactions.push(...chunk.transactions);
    }
    if (shouldFetch("refunds")) {
      data.refunds.push(...chunk.refunds);
    }
    if (shouldFetch("fulfillments")) {
      data.fulfillments.push(...chunk.fulfillments);
    }

    if (shouldFetch("customers")) {
      for (const customer of chunk.customers) {
        uniqueCustomers.set(customer._id as string, customer);
      }
    }
    if (shouldFetch("products")) {
      for (const product of chunk.products) {
        uniqueProducts.set(product._id as string, product);
      }
    }
    if (shouldFetch("variants")) {
      for (const variant of chunk.variants) {
        uniqueVariants.set(variant._id as string, variant);
      }
    }
    if (shouldFetch("productCostComponents")) {
      for (const component of chunk.productCostComponents) {
        uniqueProductCostComponents.set(component._id as string, component);
      }
    }

    if (remainingOrders !== null) {
      remainingOrders -= chunk.orders.length;
      if (remainingOrders <= 0) {
        meta.truncatedOrders = true;
        break;
      }
    }

    if (chunk.isDone) {
      orderCursor = null;
      break;
    }

    orderCursor = chunk.cursor ?? null;
    if (!orderCursor) {
      break;
    }
  }

  if (reducedOrderChunk) {
    meta.orderChunkSize = orderChunkSize;
  }

  data.customers = shouldFetch("customers")
    ? Array.from(uniqueCustomers.values())
    : [];
  data.products = shouldFetch("products")
    ? Array.from(uniqueProducts.values())
    : [];
  data.variants = shouldFetch("variants")
    ? Array.from(uniqueVariants.values())
    : [];
  data.productCostComponents = shouldFetch("productCostComponents")
    ? Array.from(uniqueProductCostComponents.values())
    : [];

  const supplementalDatasets: Array<{
    key: "metaInsights" | "costs" | "sessions" | "analytics";
    collect: (items: Doc<any>[]) => void;
  }> = [
    {
      key: "metaInsights",
      collect: (items) => {
        for (const item of items as Doc<"metaInsights">[]) {
          uniqueMetaInsights.set(item._id as string, item);
        }
      },
    },
    {
      key: "costs",
      collect: (items) => {
        for (const item of items as Doc<"costs">[]) {
          uniqueCosts.set(item._id as string, item);
        }
      },
    },
    {
      key: "sessions",
      collect: (items) => {
        for (const item of items as Doc<"shopifySessions">[]) {
          uniqueSessions.set(item._id as string, item);
        }
      },
    },
    {
      key: "analytics",
      collect: (items) => {
        for (const item of items as Doc<"shopifyAnalytics">[]) {
          uniqueAnalytics.set(item._id as string, item);
        }
      },
    },
  ];

  for (const dataset of supplementalDatasets) {
    if (!shouldFetch(dataset.key)) {
      continue;
    }

    let cursor: string | null = null;
    let pageSize = DEFAULT_SUPPLEMENTAL_CHUNK_SIZE;
    let reducedSupplementalChunk = false;

    while (true) {
      const args = {
        ...baseArgs,
        dataset: dataset.key,
        pageSize,
        ...(cursor ? { cursor } : {}),
      } as const;

    let result: any;
    while (true) {
        try {
          result = await ctx.runQuery(
            internal.engine.analytics.gatherSupplementalAnalyticsChunk,
            args,
          );
          break;
        } catch (error) {
          if (isTooManyReadsError(error) && pageSize > MIN_SUPPLEMENTAL_CHUNK_SIZE) {
            pageSize = Math.max(MIN_SUPPLEMENTAL_CHUNK_SIZE, Math.floor(pageSize / 2));
            reducedSupplementalChunk = true;
            continue;
          }
          throw error;
        }
      }

      dataset.collect(result.items as Doc<any>[]);

      if (result.isDone) {
        cursor = null;
        break;
      }

      cursor = result.cursor ?? null;
      if (!cursor) {
        break;
      }
    }

    if (reducedSupplementalChunk) {
      meta[`${dataset.key}ChunkSize`] = pageSize;
    }
  }

  data.metaInsights = shouldFetch("metaInsights")
    ? Array.from(uniqueMetaInsights.values())
    : [];
  data.costs = shouldFetch("costs") ? Array.from(uniqueCosts.values()) : [];
  data.sessions = shouldFetch("sessions")
    ? Array.from(uniqueSessions.values())
    : [];
  data.analytics = shouldFetch("analytics")
    ? Array.from(uniqueAnalytics.values())
    : [];

  meta.processedOrderCount = data.orders.length;

  return { data, meta: Object.keys(meta).length > 0 ? meta : undefined };
}

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
    const { data, meta } = await loadOrdersAnalyticsAction(
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
