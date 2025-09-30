import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface TimestampRange {
  start: number;
  end: number;
}

const ORDER_ID_CHUNK_SIZE = 25;
const DEFAULT_ORDER_PAGE_SIZE = 40;
const MAX_ORDER_PAGE_SIZE = 100;
const DEFAULT_SUPPLEMENTAL_PAGE_SIZE = 200;
const MAX_SUPPLEMENTAL_PAGE_SIZE = 500;

interface PaginationOptions {
  cursor?: string | null;
  pageSize?: number;
}

interface PaginatedResult<T> {
  docs: T[];
  cursor: string | null;
  isDone: boolean;
}

function normalizePageSize(
  options: PaginationOptions | undefined,
  defaults: { pageSize: number; maxSize: number },
): { cursor: string | null; pageSize: number } {
  const requested = options?.pageSize ?? defaults.pageSize;
  const pageSize = Math.max(1, Math.min(requested, defaults.maxSize));
  return {
    cursor: options?.cursor ?? null,
    pageSize,
  };
}

export interface AnalyticsSourceData {
  orders: Doc<"shopifyOrders">[];
  orderItems: Doc<"shopifyOrderItems">[];
  transactions: Doc<"shopifyTransactions">[];
  refunds: Doc<"shopifyRefunds">[];
  fulfillments: Doc<"shopifyFulfillments">[];
  products: Doc<"shopifyProducts">[];
  variants: Doc<"shopifyProductVariants">[];
  customers: Doc<"shopifyCustomers">[];
  metaInsights: Doc<"metaInsights">[];
  globalCosts: Doc<"globalCosts">[];
  variantCosts: Doc<"variantCosts">[];
  sessions: Doc<"shopifySessions">[];
  analytics: Doc<"shopifyAnalytics">[];
}

export type AnalyticsSourceKey = keyof AnalyticsSourceData;

interface AnalyticsOrderChunkOptions extends PaginationOptions {
  datasets?: readonly AnalyticsSourceKey[];
}

type OrderScopedTable =
  | "shopifyOrderItems"
  | "shopifyTransactions"
  | "shopifyRefunds"
  | "shopifyFulfillments";

type OrderScopedDoc<T extends OrderScopedTable> = Doc<T>;

type OrderId = Id<"shopifyOrders">;

type OrganizationId = Id<"organizations">;

function toTimestamp(date: string, end = false): number {
  const normalized = `${date}T00:00:00.000Z`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date string provided: ${date}`);
  }

  if (end) {
    parsed.setUTCHours(23, 59, 59, 999);
  }

  return parsed.getTime();
}

export function toTimestampRange(dateRange: DateRange): TimestampRange {
  return {
    start: toTimestamp(dateRange.startDate),
    end: toTimestamp(dateRange.endDate, true),
  };
}

async function fetchOrders(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  timestamps: TimestampRange,
  options?: { limit?: number },
): Promise<{ orders: Doc<"shopifyOrders">[]; isTruncated: boolean }> {
  const baseQuery = ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization_and_created", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("shopifyCreatedAt", timestamps.start)
        .lte("shopifyCreatedAt", timestamps.end),
    )
    .order("desc");

  if (options?.limit && options.limit > 0) {
    const page = await baseQuery.paginate({ numItems: options.limit, cursor: null });
    return {
      orders: page.page,
      isTruncated: !page.isDone,
    };
  }

  const orders = await baseQuery.collect();
  return {
    orders,
    isTruncated: false,
  };
}

async function fetchOrdersPage(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  timestamps: TimestampRange,
  options?: PaginationOptions,
): Promise<PaginatedResult<Doc<"shopifyOrders">>> {
  const { cursor, pageSize } = normalizePageSize(options, {
    pageSize: DEFAULT_ORDER_PAGE_SIZE,
    maxSize: MAX_ORDER_PAGE_SIZE,
  });

  const page = await ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization_and_created", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("shopifyCreatedAt", timestamps.start)
        .lte("shopifyCreatedAt", timestamps.end),
    )
    .order("asc")
    .paginate({ numItems: pageSize, cursor });

  return {
    docs: page.page,
    cursor: page.isDone ? null : page.continueCursor,
    isDone: page.isDone,
  };
}

export type AnalyticsOrderChunk = Pick<
  AnalyticsSourceData,
  | "orders"
  | "orderItems"
  | "transactions"
  | "refunds"
  | "fulfillments"
  | "products"
  | "variants"
  | "customers"
  | "variantCosts"
>;

export interface AnalyticsOrderChunkResult {
  data: AnalyticsOrderChunk;
  cursor: string | null;
  isDone: boolean;
}

export async function fetchAnalyticsOrderChunk(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  dateRange: DateRange,
  options?: AnalyticsOrderChunkOptions,
): Promise<AnalyticsOrderChunkResult> {
  const requested = options?.datasets ? new Set(options.datasets) : null;
  const shouldFetch = (key: AnalyticsSourceKey) => (requested ? requested.has(key) : true);

  const needCustomers = shouldFetch("customers");
  const needProducts = shouldFetch("products");
  const needVariants = shouldFetch("variants");
  const needVariantCosts = shouldFetch("variantCosts");
  const needTransactions = shouldFetch("transactions");
  const needRefunds = shouldFetch("refunds");
  const needFulfillments = shouldFetch("fulfillments");
  const needOrderItems =
    shouldFetch("orderItems") || needProducts || needVariants || needVariantCosts;

  const timestamps = toTimestampRange(dateRange);
  const orderPage = await fetchOrdersPage(ctx, organizationId, timestamps, options);
  const orders = orderPage.docs;
  const orderIds = orders.map((order) => order._id as OrderId);

  let orderItems: Doc<"shopifyOrderItems">[] = [];
  if (needOrderItems && orderIds.length > 0) {
    orderItems = await fetchOrderScopedDocs(ctx, "shopifyOrderItems", organizationId, orderIds);
  }

  let transactions: Doc<"shopifyTransactions">[] = [];
  if (needTransactions && orderIds.length > 0) {
    transactions = await fetchOrderScopedDocs(ctx, "shopifyTransactions", organizationId, orderIds);
  }

  let refunds: Doc<"shopifyRefunds">[] = [];
  if (needRefunds && orderIds.length > 0) {
    refunds = await fetchOrderScopedDocs(ctx, "shopifyRefunds", organizationId, orderIds);
  }

  let fulfillments: Doc<"shopifyFulfillments">[] = [];
  if (needFulfillments && orderIds.length > 0) {
    fulfillments = await fetchOrderScopedDocs(ctx, "shopifyFulfillments", organizationId, orderIds);
  }

  const customerIds = needCustomers ? new Set<Id<"shopifyCustomers">>() : null;
  if (customerIds) {
    for (const order of orders) {
      if (order.customerId) {
        customerIds.add(order.customerId as Id<"shopifyCustomers">);
      }
    }
  }

  const productIds = needProducts ? new Set<Id<"shopifyProducts">>() : null;
  const variantIds =
    needVariants || needVariantCosts ? new Set<Id<"shopifyProductVariants">>() : null;

  if ((productIds || variantIds) && orderItems.length > 0) {
    for (const item of orderItems) {
      if (productIds && item.productId) {
        productIds.add(item.productId as Id<"shopifyProducts">);
      }
      if (variantIds && item.variantId) {
        variantIds.add(item.variantId as Id<"shopifyProductVariants">);
      }
    }
  }

  let customers: Doc<"shopifyCustomers">[] = [];
  if (customerIds && customerIds.size > 0) {
    customers = await fetchCustomers(ctx, customerIds);
  }

  let products: Doc<"shopifyProducts">[] = [];
  if (productIds && productIds.size > 0) {
    products = await fetchProducts(ctx, productIds);
  }

  let variantCosts: Doc<"variantCosts">[] = [];
  if (variantIds && needVariantCosts && variantIds.size > 0) {
    variantCosts = await fetchVariantCosts(
      ctx,
      organizationId,
      variantIds,
      timestamps,
    );
  }

  let variants: Doc<"shopifyProductVariants">[] = [];
  if (variantIds && needVariants && variantIds.size > 0) {
    variants = await fetchVariants(ctx, variantIds);
  }

  return {
    data: {
      orders,
      orderItems: shouldFetch("orderItems") ? orderItems : [],
      transactions: shouldFetch("transactions") ? transactions : [],
      refunds: shouldFetch("refunds") ? refunds : [],
      fulfillments: shouldFetch("fulfillments") ? fulfillments : [],
      products: shouldFetch("products") ? products : [],
      variants: shouldFetch("variants") ? variants : [],
      customers: shouldFetch("customers") ? customers : [],
      variantCosts: shouldFetch("variantCosts") ? variantCosts : [],
    },
    cursor: orderPage.cursor,
    isDone: orderPage.isDone,
  };
}

async function fetchOrderScopedDocs<T extends OrderScopedTable>(
  ctx: QueryCtx,
  table: T,
  _organizationId: OrganizationId,
  orderIds: OrderId[],
): Promise<Array<OrderScopedDoc<T>>> {
  if (orderIds.length === 0) {
    return [];
  }

  const chunks: OrderId[][] = [];
  for (let i = 0; i < orderIds.length; i += ORDER_ID_CHUNK_SIZE) {
    chunks.push(orderIds.slice(i, i + ORDER_ID_CHUNK_SIZE));
  }

  const results: Array<OrderScopedDoc<T>>[] = [];

  for (const chunk of chunks) {
    // Query each order in parallel but keep chunk sizes modest to avoid fan-out pressure.
    const chunkResults = await Promise.all(
      chunk.map((orderId) =>
        ctx.db
          .query(table)
          .withIndex("by_order", (q: any) => q.eq("orderId", orderId))
          .collect(),
      ),
    );

    results.push(...chunkResults);
  }

  return results.flat();
}

async function fetchMetaInsights(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  dateRange: DateRange,
): Promise<Doc<"metaInsights">[]> {
  return await ctx.db
    .query("metaInsights")
    .withIndex("by_org_date", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("date", dateRange.startDate)
        .lte("date", dateRange.endDate),
    )
    .collect();
}

async function fetchOrganizationStoreIds(
  ctx: QueryCtx,
  organizationId: OrganizationId,
): Promise<Array<Id<"shopifyStores">>> {
  const activeStores = await ctx.db
    .query("shopifyStores")
    .withIndex("by_organization_and_active", (q) =>
      q.eq("organizationId", organizationId).eq("isActive", true),
    )
    .collect();

  if (activeStores.length > 0) {
    return activeStores.map((store) => store._id as Id<"shopifyStores">);
  }

  const allStores = await ctx.db
    .query("shopifyStores")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  return allStores.map((store) => store._id as Id<"shopifyStores">);
}

async function fetchSessions(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  timestamps: TimestampRange,
  storeIds?: ReadonlySet<Id<"shopifyStores">>,
): Promise<Doc<"shopifySessions">[]> {
  const targetStoreIds = storeIds && storeIds.size > 0
    ? Array.from(storeIds)
    : await fetchOrganizationStoreIds(ctx, organizationId);

  if (targetStoreIds.length === 0) {
    return [];
  }

  const batches = await Promise.all(
    targetStoreIds.map((storeId) =>
      ctx.db
        .query("shopifySessions")
        .withIndex("by_store_and_date", (q) =>
          q
            .eq("storeId", storeId)
            .gte("startTime", timestamps.start)
            .lte("startTime", timestamps.end),
        )
        .collect(),
    ),
  );

  return batches.flat();
}

async function fetchAnalytics(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  dateRange: DateRange,
): Promise<Doc<"shopifyAnalytics">[]> {
  return await ctx.db
    .query("shopifyAnalytics")
    .withIndex("by_organization_date", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("date", dateRange.startDate)
        .lte("date", dateRange.endDate),
    )
    .collect();
}

async function fetchCustomers(
  ctx: QueryCtx,
  customerIds: ReadonlySet<Id<"shopifyCustomers">>,
): Promise<Doc<"shopifyCustomers">[]> {
  if (customerIds.size === 0) {
    return [];
  }

  const docs = await Promise.all(
    Array.from(customerIds).map((customerId) => ctx.db.get(customerId)),
  );

  return docs.filter((doc): doc is Doc<"shopifyCustomers"> => doc !== null);
}

async function fetchProducts(
  ctx: QueryCtx,
  productIds: ReadonlySet<Id<"shopifyProducts">>,
): Promise<Doc<"shopifyProducts">[]> {
  if (productIds.size === 0) {
    return [];
  }

  const docs = await Promise.all(
    Array.from(productIds).map((productId) => ctx.db.get(productId)),
  );

  return docs.filter((doc): doc is Doc<"shopifyProducts"> => doc !== null);
}

async function fetchVariants(
  ctx: QueryCtx,
  variantIds: ReadonlySet<Id<"shopifyProductVariants">>,
): Promise<Doc<"shopifyProductVariants">[]> {
  if (variantIds.size === 0) {
    return [];
  }

  const docs = await Promise.all(
    Array.from(variantIds).map((variantId) => ctx.db.get(variantId)),
  );

  return docs.filter((doc): doc is Doc<"shopifyProductVariants"> => doc !== null);
}

async function fetchVariantCosts(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  variantIds: ReadonlySet<Id<"shopifyProductVariants">>,
  timestamps: TimestampRange,
): Promise<Doc<"variantCosts">[]> {
  if (variantIds.size === 0) {
    return [];
  }

  const batches: Doc<"variantCosts">[][] = await Promise.all(
    Array.from(variantIds).map((variantId) =>
      ctx.db
        .query("variantCosts")
        .withIndex("by_org_variant", (q) =>
          q.eq("organizationId", organizationId).eq("variantId", variantId),
        )
        .collect(),
    ),
  );

  return batches
    .flat()
    .filter((component) => {
      const from = component.effectiveFrom;
      return from <= timestamps.end;
    });
}

async function fetchGlobalCosts(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  timestamps: TimestampRange,
): Promise<Doc<"globalCosts">[]> {
  const costs = await ctx.db
    .query("globalCosts")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  return costs.filter((cost) => {
    const from = cost.effectiveFrom;
    const to = cost.effectiveTo ?? Number.POSITIVE_INFINITY;
    return cost.isActive && from <= timestamps.end && to >= timestamps.start;
  });
}

export async function fetchMetaInsightsPage(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  dateRange: DateRange,
  options?: PaginationOptions,
): Promise<PaginatedResult<Doc<"metaInsights">>> {
  const { cursor, pageSize } = normalizePageSize(options, {
    pageSize: DEFAULT_SUPPLEMENTAL_PAGE_SIZE,
    maxSize: MAX_SUPPLEMENTAL_PAGE_SIZE,
  });

  const page = await ctx.db
    .query("metaInsights")
    .withIndex("by_org_date", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("date", dateRange.startDate)
        .lte("date", dateRange.endDate),
    )
    .paginate({ numItems: pageSize, cursor });

  return {
    docs: page.page,
    cursor: page.isDone ? null : page.continueCursor,
    isDone: page.isDone,
  };
}

export async function fetchGlobalCostsPage(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  timestamps: TimestampRange,
  options?: PaginationOptions,
): Promise<PaginatedResult<Doc<"globalCosts">>> {
  const { cursor, pageSize } = normalizePageSize(options, {
    pageSize: DEFAULT_SUPPLEMENTAL_PAGE_SIZE,
    maxSize: MAX_SUPPLEMENTAL_PAGE_SIZE,
  });

  const page = await ctx.db
    .query("globalCosts")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .paginate({ numItems: pageSize, cursor });

  const docs = page.page.filter((cost) => {
    const from = cost.effectiveFrom;
    const to = cost.effectiveTo ?? Number.POSITIVE_INFINITY;
    return cost.isActive && from <= timestamps.end && to >= timestamps.start;
  });

  return {
    docs,
    cursor: page.isDone ? null : page.continueCursor,
    isDone: page.isDone,
  };
}

export async function fetchSessionsPage(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  timestamps: TimestampRange,
  options?: PaginationOptions,
): Promise<PaginatedResult<Doc<"shopifySessions">>> {
  const { cursor, pageSize } = normalizePageSize(options, {
    pageSize: DEFAULT_SUPPLEMENTAL_PAGE_SIZE,
    maxSize: MAX_SUPPLEMENTAL_PAGE_SIZE,
  });

  const page = await ctx.db
    .query("shopifySessions")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .paginate({ numItems: pageSize, cursor });

  const docs = page.page.filter(
    (session) =>
      session.startTime >= timestamps.start && session.startTime <= timestamps.end,
  );

  return {
    docs,
    cursor: page.isDone ? null : page.continueCursor,
    isDone: page.isDone,
  };
}

export async function fetchShopifyAnalyticsPage(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  dateRange: DateRange,
  options?: PaginationOptions,
): Promise<PaginatedResult<Doc<"shopifyAnalytics">>> {
  const { cursor, pageSize } = normalizePageSize(options, {
    pageSize: DEFAULT_SUPPLEMENTAL_PAGE_SIZE,
    maxSize: MAX_SUPPLEMENTAL_PAGE_SIZE,
  });

  const page = await ctx.db
    .query("shopifyAnalytics")
    .withIndex("by_organization_date", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("date", dateRange.startDate)
        .lte("date", dateRange.endDate),
    )
    .paginate({ numItems: pageSize, cursor });

  return {
    docs: page.page,
    cursor: page.isDone ? null : page.continueCursor,
    isDone: page.isDone,
  };
}

export async function fetchAnalyticsSourceData(
  ctx: QueryCtx,
  organizationId: OrganizationId,
  dateRange: DateRange,
  options?: {
    datasets?: readonly AnalyticsSourceKey[];
    limits?: {
      maxOrders?: number;
    };
  },
): Promise<{ data: AnalyticsSourceData; meta?: Record<string, unknown> }> {
  const requested = options?.datasets ? new Set(options.datasets) : null;
  const shouldFetch = (key: AnalyticsSourceKey) => requested ? requested.has(key) : true;

  const timestamps = toTimestampRange(dateRange);
  const meta: Record<string, unknown> = {};

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
    variantCosts: [],
    sessions: [],
    analytics: [],
  };

  const needsOrders =
    shouldFetch("orders") ||
    shouldFetch("orderItems") ||
    shouldFetch("transactions") ||
    shouldFetch("refunds") ||
    shouldFetch("fulfillments") ||
    shouldFetch("customers") ||
    shouldFetch("products") ||
    shouldFetch("variants") ||
    shouldFetch("variantCosts");

  let orders: Doc<"shopifyOrders">[] = [];
  if (needsOrders) {
    const { orders: fetchedOrders, isTruncated } = await fetchOrders(ctx, organizationId, timestamps, {
      limit: options?.limits?.maxOrders,
    });
    orders = fetchedOrders;
    if (isTruncated) {
      meta.truncatedOrders = true;
      meta.processedOrderCount = orders.length;
    }
    if (shouldFetch("orders")) {
      data.orders = orders;
    }
  }

  const orderIds = orders.map((order) => order._id as OrderId);

  const storeIds = new Set<Id<"shopifyStores">>();
  if (orders.length > 0) {
    for (const order of orders) {
      if (order.storeId) {
        storeIds.add(order.storeId as Id<"shopifyStores">);
      }
    }
  }

  const needsOrderItems =
    shouldFetch("orderItems") ||
    shouldFetch("products") ||
    shouldFetch("variants") ||
    shouldFetch("variantCosts");

  let orderItems: Doc<"shopifyOrderItems">[] = [];
  if (needsOrderItems && orderIds.length > 0) {
    orderItems = await fetchOrderScopedDocs(ctx, "shopifyOrderItems", organizationId, orderIds);
  }
  if (shouldFetch("orderItems")) {
    data.orderItems = orderItems;
  }

  if (shouldFetch("transactions") && orderIds.length > 0) {
    data.transactions = await fetchOrderScopedDocs(
      ctx,
      "shopifyTransactions",
      organizationId,
      orderIds,
    );
  }

  if (shouldFetch("refunds") && orderIds.length > 0) {
    data.refunds = await fetchOrderScopedDocs(
      ctx,
      "shopifyRefunds",
      organizationId,
      orderIds,
    );
  }

  if (shouldFetch("fulfillments") && orderIds.length > 0) {
    data.fulfillments = await fetchOrderScopedDocs(
      ctx,
      "shopifyFulfillments",
      organizationId,
      orderIds,
    );
  }

  const customerIds = shouldFetch("customers") ? new Set<Id<"shopifyCustomers">>() : null;
  if (customerIds && orders.length > 0) {
    for (const order of orders) {
      if (order.customerId) {
        customerIds.add(order.customerId as Id<"shopifyCustomers">);
      }
    }
  }

  if (customerIds) {
    data.customers = await fetchCustomers(ctx, customerIds);
  }

  const shouldLoadProducts = shouldFetch("products");
  const shouldLoadVariants = shouldFetch("variants") || shouldFetch("variantCosts");

  const productIds = shouldLoadProducts ? new Set<Id<"shopifyProducts">>() : null;
  const variantIds = shouldLoadVariants ? new Set<Id<"shopifyProductVariants">>() : null;

  if ((productIds || variantIds) && orderItems.length > 0) {
    for (const item of orderItems) {
      if (productIds && item.productId) {
        productIds.add(item.productId as Id<"shopifyProducts">);
      }
      if (variantIds && item.variantId) {
        variantIds.add(item.variantId as Id<"shopifyProductVariants">);
      }
    }
  }

  if (productIds) {
    data.products = await fetchProducts(ctx, productIds);
  }

  let variantCosts: Doc<"variantCosts">[] = [];
  if (shouldFetch("variantCosts") && variantIds && variantIds.size > 0) {
    variantCosts = await fetchVariantCosts(
      ctx,
      organizationId,
      variantIds,
      timestamps,
    );
    data.variantCosts = variantCosts;
  }

  if (shouldFetch("variantCosts") && !data.variantCosts.length) {
    data.variantCosts = [];
  }

  if (variantIds && shouldFetch("variants")) {
    const remainingVariantIds = new Set(variantIds);
    if (variantCosts.length > 0) {
      for (const component of variantCosts) {
        const variantId = component.variantId as Id<"shopifyProductVariants">;
        remainingVariantIds.delete(variantId);
      }
    }

    data.variants = remainingVariantIds.size > 0 ? await fetchVariants(ctx, remainingVariantIds) : [];
  }

  if (!shouldFetch("variantCosts")) {
    data.variantCosts = [];
  }

  if (shouldFetch("metaInsights")) {
    data.metaInsights = await fetchMetaInsights(ctx, organizationId, dateRange);
  }

  if (shouldFetch("globalCosts")) {
    data.globalCosts = await fetchGlobalCosts(ctx, organizationId, timestamps);
  }

  if (shouldFetch("sessions")) {
    data.sessions = await fetchSessions(
      ctx,
      organizationId,
      timestamps,
      storeIds.size > 0 ? storeIds : undefined,
    );
  }

  if (shouldFetch("analytics")) {
    data.analytics = await fetchAnalytics(ctx, organizationId, dateRange);
  }

  return { data, meta: Object.keys(meta).length > 0 ? meta : undefined };
}

export const ANALYTICS_SOURCE_KEYS = [
  "orders",
  "orderItems",
  "transactions",
  "refunds",
  "fulfillments",
  "products",
  "variants",
  "customers",
  "metaInsights",
  "globalCosts",
  "variantCosts",
  "sessions",
  "analytics",
] as const;

export function validateDateRange(range: DateRange): DateRange {
  if (!range.startDate || !range.endDate) {
    throw new Error("Both startDate and endDate are required");
  }

  // Ensure start <= end
  const startTs = toTimestamp(range.startDate);
  const endTs = toTimestamp(range.endDate, true);

  if (startTs > endTs) {
    throw new Error("startDate must be before or equal to endDate");
  }

  return range;
}
