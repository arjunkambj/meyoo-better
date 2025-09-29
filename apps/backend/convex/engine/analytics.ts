import { v } from "convex/values";
import type { Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalQuery } from "../_generated/server";
import {
  ANALYTICS_SOURCE_KEYS,
  type AnalyticsSourceKey,
  type DateRange,
  fetchAnalyticsOrderChunk,
  fetchCostsPage,
  fetchMetaInsightsPage,
  fetchSessionsPage,
  fetchShopifyAnalyticsPage,
  toTimestampRange,
  validateDateRange,
} from "../utils/analyticsSource";

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
  costs: v.number(),
  productCostComponents: v.number(),
  sessions: v.number(),
  analytics: v.number(),
});

type DatasetCounts = Infer<typeof datasetCountValidator>;

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
      costs: 0,
      productCostComponents: 0,
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
      for (const component of chunk.productCostComponents) {
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
    counts.productCostComponents = productCostComponentIds.size;

    const accumulateSupplementalCounts = async (
      dataset: "metaInsights" | "costs" | "sessions" | "analytics",
    ) => {
      let cursor: string | null = null;
      let total = 0;

      while (true) {
        const pageArgs: {
          organizationId: string;
          startDate: string;
          endDate: string;
          dataset: "metaInsights" | "costs" | "sessions" | "analytics";
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
      accumulateSupplementalCounts("costs"),
      accumulateSupplementalCounts("sessions"),
      accumulateSupplementalCounts("analytics"),
    ]);

    counts.metaInsights = metaInsightCount;
    counts.costs = costCount;
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
  v.literal("costs"),
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
    productCostComponents: v.array(v.any()),
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
      case "costs": {
        const result = await fetchCostsPage(ctx, organizationId, timestamps, {
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
