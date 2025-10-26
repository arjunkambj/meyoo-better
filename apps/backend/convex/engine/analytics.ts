import { parseDate } from "@internationalized/date";
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
import { computeOverviewMetrics, computePlatformMetrics, computeChannelRevenue } from "../utils/analyticsAggregations";
import { msToDateString, normalizeDateString } from "../utils/date";
import { loadAnalyticsWithChunks } from "../utils/analyticsLoader";
import type { AnalyticsResponse } from "../web/analyticsShared";
import { toUtcRangeForOffset } from "@repo/time";
import { getShopUtcOffsetMinutes } from "../../libs/time/shopTime";
import { createJob, PRIORITY } from "./workpool";
import { resolveDateRangeOrDefault } from "../utils/orgDateRange";

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

function buildDateRangeForLocalDay(
  normalizedDate: string,
  timezone: string | null | undefined,
  fallbackOffsetMinutes: number,
): DateRange {
  if (timezone) {
    try {
      const startCalendar = parseDate(normalizedDate);
      const startUtc = startCalendar.toDate(timezone);
      const endExclusiveUtc = startCalendar.add({ days: 1 }).toDate(timezone);

      return {
        startDate: normalizedDate,
        endDate: normalizedDate,
        startDateTimeUtc: startUtc.toISOString(),
        endDateTimeUtc: new Date(endExclusiveUtc.getTime() - 1).toISOString(),
        endDateTimeUtcExclusive: endExclusiveUtc.toISOString(),
        dayCount: 1,
      } satisfies DateRange;
    } catch (_error) {
      // Fallback to offset-based calculation when timezone conversion fails
    }
  }

  const fallbackRange = toUtcRangeForOffset(
    { startDate: normalizedDate, endDate: normalizedDate },
    fallbackOffsetMinutes,
  );

  return {
    startDate: normalizedDate,
    endDate: normalizedDate,
    startDateTimeUtc: fallbackRange.startDateTimeUtc,
    endDateTimeUtc: fallbackRange.endDateTimeUtc,
    endDateTimeUtcExclusive: fallbackRange.endDateTimeUtcExclusive,
    dayCount: fallbackRange.dayCount,
  } satisfies DateRange;
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
    const fallbackDays = Math.max(1, args.dateRange?.daysBack ?? 30);
    const range = await resolveDateRangeOrDefault(
      ctx,
      args.organizationId as Id<"organizations">,
      args.dateRange,
      fallbackDays,
    );
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
        startDateTimeUtc?: string;
        endDateTimeUtc?: string;
        endDateTimeUtcExclusive?: string;
        cursor?: string;
      } = {
        organizationId,
        startDate: range.startDate,
        endDate: range.endDate,
        ...(range.startDateTimeUtc ? { startDateTimeUtc: range.startDateTimeUtc } : {}),
        ...(range.endDateTimeUtc ? { endDateTimeUtc: range.endDateTimeUtc } : {}),
        ...(range.endDateTimeUtcExclusive
          ? { endDateTimeUtcExclusive: range.endDateTimeUtcExclusive }
          : {}),
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
          startDateTimeUtc?: string;
          endDateTimeUtc?: string;
          endDateTimeUtcExclusive?: string;
          dataset: "metaInsights" | "globalCosts" | "sessions" | "analytics";
          cursor?: string;
        } = {
          organizationId,
          startDate: range.startDate,
          endDate: range.endDate,
          ...(range.startDateTimeUtc ? { startDateTimeUtc: range.startDateTimeUtc } : {}),
          ...(range.endDateTimeUtc ? { endDateTimeUtc: range.endDateTimeUtc } : {}),
          ...(range.endDateTimeUtcExclusive
            ? { endDateTimeUtcExclusive: range.endDateTimeUtcExclusive }
            : {}),
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

export const enqueueDailyRebuildRequests = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    dates: v.array(v.string()),
    debounceMs: v.optional(v.number()),
    scope: v.optional(v.string()),
  },
  returns: v.object({ dates: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const debounceWindow = Math.max(0, args.debounceMs ?? 4_000);
    const normalizedDates = new Set<string>();

    for (const rawDate of args.dates) {
      try {
        normalizedDates.add(normalizeDateString(rawDate));
      } catch (_error) {
        // Skip invalid dates
      }
    }

    if (normalizedDates.size === 0) {
      return { dates: [] };
    }

    const scheduledDates: string[] = [];

    for (const date of normalizedDates) {
      const existing = await ctx.db
        .query("analyticsRebuildLocks")
        .withIndex("by_org_date", (q) =>
          q.eq("organizationId", args.organizationId).eq("date", date),
        )
        .first();

      const lockExpiresAt = now + debounceWindow;
      let shouldSchedule = false;

      if (existing) {
        const nextScope = args.scope ?? existing.lastScope;
        const shouldExtend = existing.lockedUntil < lockExpiresAt;
        const scopeChanged = nextScope !== existing.lastScope;

        if (shouldExtend || scopeChanged) {
          await ctx.db.patch(existing._id, {
            ...(shouldExtend ? { lockedUntil: lockExpiresAt } : {}),
            ...(scopeChanged ? { lastScope: nextScope ?? undefined } : {}),
            createdAt: existing.createdAt ?? now,
            updatedAt: now,
          });
        }

        if (existing.lockedUntil <= now) {
          shouldSchedule = true;
        }
      } else {
        await ctx.db.insert("analyticsRebuildLocks", {
          organizationId: args.organizationId,
          date,
          lockedUntil: lockExpiresAt,
          lastScope: args.scope,
          createdAt: now,
          updatedAt: now,
        });
        shouldSchedule = true;
      }

      if (shouldSchedule) {
        const delay = Math.max(lockExpiresAt - now, 0);
        await ctx.scheduler.runAfter(
          delay,
          internal.engine.analytics.processRebuildLock,
          {
            organizationId: args.organizationId,
            date,
          },
        );
      }

      scheduledDates.push(date);
    }

    return { dates: scheduledDates };
  },
});

export const consumeRebuildLock = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
  },
  returns: v.object({
    ready: v.boolean(),
    lockedUntil: v.optional(v.number()),
    scope: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const lock = await ctx.db
      .query("analyticsRebuildLocks")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("date", args.date),
      )
      .first();

    if (!lock) {
      return { ready: false };
    }

    const now = Date.now();

    if (lock.lockedUntil > now) {
      return {
        ready: false,
        lockedUntil: lock.lockedUntil,
        scope: lock.lastScope ?? undefined,
      };
    }

    await ctx.db.delete(lock._id);

    return {
      ready: true,
      scope: lock.lastScope ?? undefined,
    };
  },
});

export const processRebuildLock = internalAction({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      internal.engine.analytics.consumeRebuildLock,
      args,
    );

    if (!result) {
      return null;
    }

    const now = Date.now();

    if (!result.ready) {
      if (result.lockedUntil && result.lockedUntil > now) {
        await ctx.scheduler.runAfter(
          Math.max(result.lockedUntil - now, 0),
          internal.engine.analytics.processRebuildLock,
          args,
        );
      }

      return null;
    }

    try {
      await createJob(
        ctx,
        "analytics:rebuildDaily",
        PRIORITY.LOW,
        {
          organizationId: args.organizationId,
          dates: [args.date],
        },
        {
          context: {
            scope: result.scope ?? "analytics.debounce",
            date: args.date,
          },
        },
      );
    } catch (error) {
      await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
        organizationId: args.organizationId,
        dates: [args.date],
        debounceMs: 10_000,
        scope: result.scope ?? "analytics.debounce",
      });
      throw error;
    }

    return null;
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
    startDateTimeUtc: v.optional(v.string()),
    endDateTimeUtc: v.optional(v.string()),
    endDateTimeUtcExclusive: v.optional(v.string()),
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
      startDateTimeUtc: args.startDateTimeUtc ?? undefined,
      endDateTimeUtc: args.endDateTimeUtc ?? undefined,
      endDateTimeUtcExclusive: args.endDateTimeUtcExclusive ?? undefined,
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
    startDateTimeUtc: v.optional(v.string()),
    endDateTimeUtc: v.optional(v.string()),
    endDateTimeUtcExclusive: v.optional(v.string()),
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
      startDateTimeUtc: args.startDateTimeUtc ?? undefined,
      endDateTimeUtc: args.endDateTimeUtc ?? undefined,
      endDateTimeUtcExclusive: args.endDateTimeUtcExclusive ?? undefined,
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
    const organization = await ctx.db.get(args.organizationId);
    const dateOptions = organization?.timezone ? { timezone: organization.timezone } : undefined;
    const earliestCandidates: string[] = [];
    const latestCandidates: string[] = [];

    const addEarliestMs = (value: number | null | undefined) => {
      const normalized = msToDateString(value ?? null, dateOptions);
      if (normalized) {
        earliestCandidates.push(normalized);
      }
    };

    const addLatestMs = (value: number | null | undefined) => {
      const normalized = msToDateString(value ?? null, dateOptions);
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

type CustomerDailyActivityPayload = {
  customerKey: string;
  orders: number;
  prepaidOrders: number;
  revenue: number;
  lifetimeOrders?: number;
  customerCreatedAt?: number;
};

type DailyMetricsComputation = {
  metrics: DailyMetricsPayload;
  customerActivities: CustomerDailyActivityPayload[];
  customersCreated: number;
};

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

function normalizeFulfillmentStatus(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function resolveFulfillmentStatus(order: GenericRecord): string {
  const candidates = [
    order.displayFulfillmentStatus,
    order.fulfillmentStatus,
    order.fulfillment_status,
    order.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return "";
}

function isOrderFulfilled(order: GenericRecord): boolean {
  const normalized = normalizeFulfillmentStatus(resolveFulfillmentStatus(order));
  if (!normalized) {
    return false;
  }

  if (normalized.includes("partial") || normalized.includes("unfulfilled")) {
    return false;
  }

  if (
    normalized.includes("fulfilled") ||
    normalized.includes("delivered") ||
    normalized.includes("complete") ||
    normalized.includes("shipped") ||
    normalized.includes("success")
  ) {
    return true;
  }

  return false;
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
): DailyMetricsComputation {
  const overview = computeOverviewMetrics(response);
  const platformMetrics = computePlatformMetrics(response);
  const channelRevenue = computeChannelRevenue(response);
  const summary = overview?.summary;

  const orders = (response.data.orders ?? []) as GenericRecord[];
  const transactions = (response.data.transactions ?? []) as GenericRecord[];
  const refunds = (response.data.refunds ?? []) as GenericRecord[];
  const orderItems = (response.data.orderItems ?? []) as GenericRecord[];
  const customerDocs = (response.data.customers ?? []) as GenericRecord[];

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
  let fulfilledOrders = 0;

  const ordersPerCustomer = new Map<string, number>();

  const customerDetails = new Map<
    string,
    {
      lifetimeOrders?: number;
      customerCreatedAt?: number;
    }
  >();

  for (const customer of customerDocs) {
    const key = toStringId(customer._id ?? customer.id ?? customer.customerId ?? customer.shopifyId);
    if (!key) {
      continue;
    }

    const lifetimeOrders = toSafeNumber(customer.ordersCount ?? customer.orders_count);
    const createdAt = toSafeNumber(customer.shopifyCreatedAt ?? customer.shopify_created_at);

    customerDetails.set(key, {
      lifetimeOrders: lifetimeOrders > 0 ? lifetimeOrders : undefined,
      customerCreatedAt: Number.isFinite(createdAt) ? createdAt : undefined,
    });
  }

  type ActivityAccumulator = {
    orders: number;
    prepaidOrders: number;
    revenue: number;
    lifetimeOrders?: number;
    customerCreatedAt?: number;
  };

  const activityMap = new Map<string, ActivityAccumulator>();

  const toRevenueNumber = (order: GenericRecord): number => {
    const revenueCandidate =
      order.totalPrice ??
      order.total_price ??
      order.subtotalPrice ??
      order.subtotal_price ??
      order.total ??
      0;
    return toSafeNumber(revenueCandidate);
  };

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

    const cancelled = isCancelledOrder(order);
    if (cancelled) {
      cancelledOrders += 1;
    }

    if (!cancelled && isOrderFulfilled(order)) {
      fulfilledOrders += 1;
    }

    const customerKey = order.customerId ? String(order.customerId) : undefined;
    if (customerKey) {
      ordersPerCustomer.set(
        customerKey,
        (ordersPerCustomer.get(customerKey) ?? 0) + 1,
      );
    }

    if (!customerKey || cancelled) {
      continue;
    }

    const info = customerDetails.get(customerKey);
    const existing = activityMap.get(customerKey) ?? {
      orders: 0,
      prepaidOrders: 0,
      revenue: 0,
      lifetimeOrders: info?.lifetimeOrders,
      customerCreatedAt: info?.customerCreatedAt,
    } satisfies ActivityAccumulator;

    existing.orders += 1;
    if (classification === "prepaid") {
      existing.prepaidOrders += 1;
    }
    const orderRevenue = toRevenueNumber(order);
    if (orderRevenue > 0) {
      existing.revenue += orderRevenue;
    }
    if (typeof info?.lifetimeOrders === "number") {
      existing.lifetimeOrders = info.lifetimeOrders;
    }
    if (typeof info?.customerCreatedAt === "number") {
      existing.customerCreatedAt = info.customerCreatedAt;
    }

    activityMap.set(customerKey, existing);
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
  // repeatCustomers should match the same calculation as returningCustomers
  // (customers with lifetime order count > 1)
  const repeatCustomers = returningCustomers;

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

  // uniqueCustomers = customers who PURCHASED (paid customers)
  const uniqueCustomers = ordersPerCustomer.size;

  // totalCustomers = ALL customers (from summary aggregation, which includes all customers in system)
  // If not available, fall back to uniqueCustomers (paid customers only)
  const totalCustomers = toSafeNumber(summary?.customers) || uniqueCustomers;

  const customerBreakdown = newCustomers + returningCustomers + repeatCustomers > 0
    ? sanitizeDocument({
        newCustomers: newCustomers || undefined,
        returningCustomers: returningCustomers || undefined,
        repeatCustomers: repeatCustomers || undefined,
      })
    : null;

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

  const analytics = (response.data.analytics || []) as GenericRecord[];

  const totalOrders = toSafeNumber(summary?.orders);
  const totalRevenue = toSafeNumber(summary?.revenue);

  const channelRevenueEntries = channelRevenue.channels
    .filter((channel) => channel.revenue > 0 || channel.orders > 0)
    .map((channel) => ({
      name: channel.name,
      revenue: toSafeNumber(channel.revenue),
      orders: toSafeNumber(channel.orders),
    }));

  const metrics = sanitizeDocument({
    totalOrders,
    totalRevenue,
    totalDiscounts: toSafeNumber(summary?.discounts),
    grossSales: toSafeNumber(summary?.grossSales),
    paidCustomers: uniqueCustomers, // Customers who purchased
    totalCustomers, // All customers in system
    unitsSold, // Total units sold that day
    totalCogs: toSafeNumber(summary?.cogs),
    totalHandlingFee: toSafeNumber(summary?.handlingFees),
    totalShippingCost: toSafeNumber(summary?.shippingCosts),
    totalTransactionFees: toSafeNumber(summary?.transactionFees),
    totalTaxes: toSafeNumber(summary?.taxesCollected),
    blendedRoas: toSafeNumber(summary?.roas),
    blendedCtr: toSafeNumber(platformMetrics.blendedCTR),
    blendedMarketingCost: toSafeNumber(summary?.blendedMarketingCost),
    cancelledOrders,
    fulfilledOrders,
    returnedOrders,
    sessions: analytics.reduce((sum, a) => sum + toSafeNumber(a.sessions), 0),
    visitors: analytics.reduce((sum, a) => sum + toSafeNumber(a.visitors), 0),
    conversions: analytics.reduce((sum, a) => sum + toSafeNumber(a.conversions), 0),
  });

  const customersCreated = (() => {
    const startIso =
      response.dateRange.startDateTimeUtc ??
      `${response.dateRange.startDate}T00:00:00.000Z`;

    const fallbackEndExclusive = (() => {
      const parsed = Date.parse(`${response.dateRange.endDate}T00:00:00.000Z`);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      const end = new Date(parsed);
      end.setUTCDate(end.getUTCDate() + 1);
      return end.toISOString();
    })();

    const endExclusiveIso =
      response.dateRange.endDateTimeUtcExclusive ?? fallbackEndExclusive;

    const startMs = Date.parse(startIso);
    const endExclusiveMs = endExclusiveIso ? Date.parse(endExclusiveIso) : NaN;
    if (!Number.isFinite(startMs) || !Number.isFinite(endExclusiveMs)) {
      return 0;
    }

    let count = 0;
    for (const customer of customerDocs) {
      const createdAt = toSafeNumber(customer.shopifyCreatedAt ?? customer.shopify_created_at);
      if (!Number.isFinite(createdAt)) {
        continue;
      }
      if (createdAt >= startMs && createdAt < endExclusiveMs) {
        count += 1;
      }
    }
    return count;
  })();

  const activityList: CustomerDailyActivityPayload[] = Array.from(activityMap.entries()).map(
    ([customerKey, activity]) => ({
      customerKey,
      orders: activity.orders,
      prepaidOrders: activity.prepaidOrders,
      revenue: activity.revenue,
      lifetimeOrders: activity.lifetimeOrders,
      customerCreatedAt: activity.customerCreatedAt,
    }),
  );

  const metricsPayload = {
    ...metrics,
    paymentBreakdown: paymentBreakdown ?? undefined,
    customerBreakdown: customerBreakdown ?? undefined,
    channelRevenue: channelRevenueEntries.length ? channelRevenueEntries : undefined,
  } as DailyMetricsPayload;

  return {
    metrics: metricsPayload,
    customerActivities: activityList,
    customersCreated,
  } satisfies DailyMetricsComputation;
}

const dailyMetricsPayload = v.object({
  totalOrders: v.optional(v.number()),
  totalRevenue: v.optional(v.number()),
  totalDiscounts: v.optional(v.number()),
  grossSales: v.optional(v.number()),
  paidCustomers: v.optional(v.number()),
  totalCustomers: v.optional(v.number()),
  unitsSold: v.optional(v.number()),
  totalCogs: v.optional(v.number()),
  totalHandlingFee: v.optional(v.number()),
  totalShippingCost: v.optional(v.number()),
  totalTransactionFees: v.optional(v.number()),
  totalTaxes: v.optional(v.number()),
  blendedRoas: v.optional(v.number()),
  blendedCtr: v.optional(v.number()),
  blendedMarketingCost: v.optional(v.number()),
  cancelledOrders: v.optional(v.number()),
  returnedOrders: v.optional(v.number()),
  fulfilledOrders: v.optional(v.number()),
  sessions: v.optional(v.number()),
  visitors: v.optional(v.number()),
  conversions: v.optional(v.number()),
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
  channelRevenue: v.optional(
    v.array(
      v.object({
        name: v.string(),
        revenue: v.number(),
        orders: v.number(),
      }),
    ),
  ),
});

const customerDailyActivityValidator = v.object({
  customerKey: v.string(),
  orders: v.number(),
  prepaidOrders: v.optional(v.number()),
  revenue: v.optional(v.number()),
  lifetimeOrders: v.optional(v.number()),
  customerCreatedAt: v.optional(v.number()),
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

export const clearCustomerDailyActivity = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const PAGE_SIZE = 64;
    let cursor: string | null = null;
    while (true) {
      const page = await ctx.db
        .query("customerDailyActivities")
        .withIndex("by_org_date", (q) =>
          q.eq("organizationId", args.organizationId).eq("date", args.date),
        )
        .paginate({ numItems: PAGE_SIZE, cursor });

      for (const doc of page.page) {
        await ctx.db.delete(doc._id);
      }

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor ?? null;
      if (!cursor) {
        break;
      }
    }

    const summary = await ctx.db
      .query("customerDailySummaries")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("date", args.date),
      )
      .first();

    if (summary) {
      await ctx.db.delete(summary._id);
    }
  },
});

export const insertCustomerDailyActivityChunk = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
    activities: v.array(customerDailyActivityValidator),
  },
  handler: async (ctx, args) => {
    if (args.activities.length === 0) {
      return;
    }

    for (const activity of args.activities) {
      await ctx.db.insert("customerDailyActivities", {
        organizationId: args.organizationId,
        date: args.date,
        customerKey: activity.customerKey,
        orders: activity.orders,
        prepaidOrders: activity.prepaidOrders ?? undefined,
        revenue: activity.revenue ?? undefined,
        lifetimeOrders: activity.lifetimeOrders ?? undefined,
        customerCreatedAt: activity.customerCreatedAt ?? undefined,
      } as any);
    }
  },
});

export const upsertCustomerDailySummary = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
    customersCreated: v.number(),
    totalCustomers: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customerDailySummaries")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("date", args.date),
      )
      .first();

    const payload = {
      organizationId: args.organizationId,
      date: args.date,
      customersCreated: args.customersCreated,
      totalCustomers: args.totalCustomers,
    } as const;

    if (existing) {
      await ctx.db.patch(existing._id, payload as any);
    } else {
      await ctx.db.insert("customerDailySummaries", payload as any);
    }
  },
});

export const getCustomerSummaryBeforeDate = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
  },
  returns: v.union(v.null(), v.object({
    date: v.string(),
    customersCreated: v.number(),
    totalCustomers: v.number(),
  })),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("customerDailySummaries")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).lt("date", args.date),
      )
      .order("desc")
      .first();

    if (!doc) {
      return null;
    }

    return {
      date: doc.date,
      customersCreated: doc.customersCreated,
      totalCustomers: doc.totalCustomers,
    } as const;
  },
});

export const countCustomersBeforeUtcExclusive = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    endDateTimeUtcExclusive: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoffMs = Date.parse(args.endDateTimeUtcExclusive);
    if (!Number.isFinite(cutoffMs)) {
      return 0;
    }

    const PAGE_SIZE = 256;
    let total = 0;
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization_and_created", (q) =>
          q.eq("organizationId", args.organizationId).lt("shopifyCreatedAt", cutoffMs),
        )
        .order("asc")
        .paginate({
          numItems: PAGE_SIZE,
          cursor,
        });

      total += page.page.length;

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor ?? null;
    }

    return total;
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

    let timezone: string | null = null;
    try {
      const timezoneResult = await ctx.runQuery(
        internal.core.organizations.getOrganizationTimezoneInternal,
        { organizationId: args.organizationId },
      );
      timezone = timezoneResult?.timezone ?? null;
    } catch (error) {
      console.warn("[Analytics] Failed to load organization timezone", {
        organizationId: args.organizationId,
        error,
      });
    }

    let fallbackOffsetMinutes = 0;
    if (!timezone) {
      try {
        const offset = await getShopUtcOffsetMinutes(ctx as any, String(args.organizationId));
        fallbackOffsetMinutes = Number.isFinite(offset) ? offset : 0;
      } catch (error) {
        console.warn("[Analytics] Failed to resolve shop offset", {
          organizationId: args.organizationId,
          error,
        });
        fallbackOffsetMinutes = 0;
      }
    }

    const organizationId = args.organizationId as Id<"organizations">;

    for (const date of uniqueDates) {
      processed += 1;
      try {
        const normalizedDate = normalizeDateString(date);
        const dateRange = buildDateRangeForLocalDay(
          normalizedDate,
          timezone,
          fallbackOffsetMinutes,
        );
        const { data } = await loadAnalyticsWithChunks(
          ctx,
          organizationId,
          dateRange,
          {
            datasets: DAILY_METRICS_DATASETS,
          },
        );

        const response: AnalyticsResponse = {
          dateRange,
          organizationId: args.organizationId,
          data,
        };

        const {
          metrics,
          customerActivities,
          customersCreated,
        } = buildDailyMetricsFromResponse(response);

        await ctx.runMutation(internal.engine.analytics.upsertDailyMetric, {
          organizationId: args.organizationId,
          date,
          metrics,
        });

        await ctx.runMutation(internal.engine.analytics.clearCustomerDailyActivity, {
          organizationId: args.organizationId,
          date,
        });

        const ACTIVITY_CHUNK_SIZE = 64;
        for (let index = 0; index < customerActivities.length; index += ACTIVITY_CHUNK_SIZE) {
          const chunk = customerActivities.slice(index, index + ACTIVITY_CHUNK_SIZE);
          await ctx.runMutation(internal.engine.analytics.insertCustomerDailyActivityChunk, {
            organizationId: args.organizationId,
            date,
            activities: chunk,
          });
        }

        let totalCustomers = customersCreated;
        try {
          const previousSummary = await ctx.runQuery(
            internal.engine.analytics.getCustomerSummaryBeforeDate,
            {
              organizationId: args.organizationId,
              date,
            },
          );

          if (previousSummary) {
            totalCustomers = previousSummary.totalCustomers + customersCreated;
          } else if (dateRange.endDateTimeUtcExclusive) {
            const cutoffMs = Date.parse(dateRange.endDateTimeUtcExclusive);
            if (Number.isFinite(cutoffMs)) {
              const baselineTotal = await ctx.runQuery(
                internal.engine.analytics.countCustomersBeforeUtcExclusive,
                {
                  organizationId: args.organizationId,
                  endDateTimeUtcExclusive: dateRange.endDateTimeUtcExclusive,
                },
              );
              if (Number.isFinite(baselineTotal) && baselineTotal >= 0) {
                totalCustomers = Math.max(baselineTotal, customersCreated);
              }
            }
          }
        } catch (summaryError) {
          console.warn("[Analytics] Failed to derive customer summary baseline", {
            organizationId: args.organizationId,
            date,
            error: summaryError,
          });
          totalCustomers = customersCreated;
        }

        await ctx.runMutation(internal.engine.analytics.upsertCustomerDailySummary, {
          organizationId: args.organizationId,
          date,
          customersCreated,
          totalCustomers,
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
