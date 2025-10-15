import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  type AnalyticsSourceData,
  type AnalyticsSourceKey,
  type DateRange,
  getRangeEndExclusiveMs,
  getRangeStartMs,
} from "./analyticsSource";

const DEFAULT_ORDER_CHUNK_SIZE = 20;
const MIN_ORDER_CHUNK_SIZE = 1;
const DEFAULT_SUPPLEMENTAL_CHUNK_SIZE = 400;
const MIN_SUPPLEMENTAL_CHUNK_SIZE = 25;

type DatasetCollector = {
  key: "metaInsights" | "globalCosts" | "sessions" | "analytics";
  collect: (items: Doc<any>[]) => void;
};

type UniqueMaps = {
  customers: Map<string, Doc<"shopifyCustomers">>;
  products: Map<string, Doc<"shopifyProducts">>;
  variants: Map<string, Doc<"shopifyProductVariants">>;
  variantCosts: Map<string, Doc<"variantCosts">>;
  metaInsights: Map<string, Doc<"metaInsights">>;
  globalCosts: Map<string, Doc<"globalCosts">>;
  sessions: Map<string, Doc<"shopifySessions">>;
  analytics: Map<string, Doc<"shopifyAnalytics">>;
};

function isTooManyReadsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Too many reads");
}

function shouldFetchDataset(
  requested: ReadonlySet<AnalyticsSourceKey> | null,
  key: AnalyticsSourceKey,
): boolean {
  return requested ? requested.has(key) : true;
}

function createEmptyAnalyticsData(): AnalyticsSourceData {
  return {
    orders: [],
    orderItems: [],
    transactions: [],
    refunds: [],
    fulfillments: [],
    products: [],
    variants: [],
    customers: [],
    metaInsights: [],
    globalCosts: [],
    variantCosts: [],
    manualReturnRates: [],
    sessions: [],
    analytics: [],
  };
}

function createUniqueMaps(): UniqueMaps {
  return {
    customers: new Map(),
    products: new Map(),
    variants: new Map(),
    variantCosts: new Map(),
    metaInsights: new Map(),
    globalCosts: new Map(),
    sessions: new Map(),
    analytics: new Map(),
  };
}

interface SupplementalChunkMeta {
  reduced: boolean;
  pageSize: number;
}

function buildSupplementalCollectors(
  shouldFetch: (key: AnalyticsSourceKey) => boolean,
  uniqueMaps: UniqueMaps,
): DatasetCollector[] {
  const collectMetaInsights = (items: Doc<"metaInsights">[]) => {
    for (const item of items) {
      uniqueMaps.metaInsights.set(item._id as string, item);
    }
  };

  const collectGlobalCosts = (items: Doc<"globalCosts">[]) => {
    for (const item of items) {
      uniqueMaps.globalCosts.set(item._id as string, item);
    }
  };

  const collectSessions = (items: Doc<"shopifySessions">[]) => {
    for (const item of items) {
      uniqueMaps.sessions.set(item._id as string, item);
    }
  };

  const collectAnalytics = (items: Doc<"shopifyAnalytics">[]) => {
    for (const item of items) {
      uniqueMaps.analytics.set(item._id as string, item);
    }
  };

  const collectors: DatasetCollector[] = [];

  if (shouldFetch("metaInsights")) {
    collectors.push({ key: "metaInsights", collect: collectMetaInsights });
  }
  if (shouldFetch("globalCosts")) {
    collectors.push({ key: "globalCosts", collect: collectGlobalCosts });
  }
  if (shouldFetch("sessions")) {
    collectors.push({ key: "sessions", collect: collectSessions });
  }
  if (shouldFetch("analytics")) {
    collectors.push({ key: "analytics", collect: collectAnalytics });
  }

  return collectors;
}

export interface LoadAnalyticsActionOptions {
  datasets?: readonly AnalyticsSourceKey[];
  limits?: {
    maxOrders?: number;
  };
}

export async function loadAnalyticsWithChunks(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
  options?: LoadAnalyticsActionOptions,
): Promise<{ data: AnalyticsSourceData; meta?: Record<string, unknown> }> {
  const requested = options?.datasets ? new Set(options.datasets) : null;
  const shouldFetch = (key: AnalyticsSourceKey) => shouldFetchDataset(requested, key);

  const data = createEmptyAnalyticsData();
  const meta: Record<string, unknown> = {};
  const uniqueMaps = createUniqueMaps();

  const baseArgs = {
    organizationId: organizationId as string,
    startDate: range.startDate,
    endDate: range.endDate,
    ...(range.startDateTimeUtc ? { startDateTimeUtc: range.startDateTimeUtc } : {}),
    ...(range.endDateTimeUtc ? { endDateTimeUtc: range.endDateTimeUtc } : {}),
    ...(range.endDateTimeUtcExclusive
      ? { endDateTimeUtcExclusive: range.endDateTimeUtcExclusive }
      : {}),
  } as const;

  const rangeStartMs = getRangeStartMs(range);
  const rangeEndExclusiveMs = getRangeEndExclusiveMs(range);

  let orderCursor: string | null = null;
  let orderChunkSize = DEFAULT_ORDER_CHUNK_SIZE;
  let reducedOrderChunk = false;
  const maxOrders = options?.limits?.maxOrders;
  let remainingOrders = typeof maxOrders === "number" && maxOrders > 0 ? maxOrders : null;

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

    let chunk: {
      orders: Doc<"shopifyOrders">[];
      orderItems: Doc<"shopifyOrderItems">[];
      transactions: Doc<"shopifyTransactions">[];
      refunds: Doc<"shopifyRefunds">[];
      fulfillments: Doc<"shopifyFulfillments">[];
      products: Doc<"shopifyProducts">[];
      variants: Doc<"shopifyProductVariants">[];
      customers: Doc<"shopifyCustomers">[];
      variantCosts: Doc<"variantCosts">[];
      cursor?: string | null;
      isDone: boolean;
    };

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
        uniqueMaps.customers.set(customer._id as string, customer);
      }
    }
    if (shouldFetch("products")) {
      for (const product of chunk.products) {
        uniqueMaps.products.set(product._id as string, product);
      }
    }
    if (shouldFetch("variants")) {
      for (const variant of chunk.variants) {
        uniqueMaps.variants.set(variant._id as string, variant);
      }
    }
    if (shouldFetch("variantCosts")) {
      for (const component of chunk.variantCosts) {
        uniqueMaps.variantCosts.set(component._id as string, component);
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
    ? Array.from(uniqueMaps.customers.values())
    : [];
  data.products = shouldFetch("products")
    ? Array.from(uniqueMaps.products.values())
    : [];
  data.variants = shouldFetch("variants")
    ? Array.from(uniqueMaps.variants.values())
    : [];
  data.variantCosts = shouldFetch("variantCosts")
    ? Array.from(uniqueMaps.variantCosts.values())
    : [];

  const supplementalCollectors = buildSupplementalCollectors(shouldFetch, uniqueMaps);

  for (const dataset of supplementalCollectors) {
    let cursor: string | null = null;
    let pageSize = DEFAULT_SUPPLEMENTAL_CHUNK_SIZE;
    const supplementalMeta: SupplementalChunkMeta = {
      reduced: false,
      pageSize,
    };

    while (true) {
      const args = {
        ...baseArgs,
        dataset: dataset.key,
        pageSize,
        ...(cursor ? { cursor } : {}),
      } as const;

      let result: { items: Doc<any>[]; cursor?: string | null; isDone: boolean };

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
            supplementalMeta.reduced = true;
            supplementalMeta.pageSize = pageSize;
            continue;
          }
          throw error;
        }
      }

      dataset.collect(result.items);

      if (result.isDone) {
        cursor = null;
        break;
      }

      cursor = result.cursor ?? null;
      if (!cursor) {
        break;
      }
    }

    if (supplementalMeta.reduced) {
      meta[`${dataset.key}ChunkSize`] = supplementalMeta.pageSize;
    }
  }

  if (shouldFetch("manualReturnRates")) {
    const windowStart = Number.isFinite(rangeStartMs) ? rangeStartMs : undefined;
    const windowEnd = Number.isFinite(rangeEndExclusiveMs)
      ? rangeEndExclusiveMs - 1
      : undefined;

    data.manualReturnRates = await ctx.runQuery(
      internal.core.costs.getManualReturnRateEntries,
      {
        organizationId: organizationId as Id<"organizations">,
        windowStart,
        windowEnd,
      },
    );
  }

  data.metaInsights = shouldFetch("metaInsights")
    ? Array.from(uniqueMaps.metaInsights.values())
    : [];
  data.globalCosts = shouldFetch("globalCosts")
    ? Array.from(uniqueMaps.globalCosts.values())
    : [];
  data.sessions = shouldFetch("sessions")
    ? Array.from(uniqueMaps.sessions.values())
    : [];
  data.analytics = shouldFetch("analytics")
    ? Array.from(uniqueMaps.analytics.values())
    : [];

  meta.processedOrderCount = data.orders.length;

  return {
    data,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
}
