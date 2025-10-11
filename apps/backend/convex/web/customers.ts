import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  validateDateRange,
  toTimestampRange,
  type DateRange,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { loadCustomerOverviewFromDailyMetrics } from "../utils/dailyMetrics";
import { dateRangeValidator, defaultDateRange } from "./analyticsShared";

const MAX_CUSTOMER_PAGE_SIZE = 50;
const DEFAULT_CUSTOMER_PAGE_SIZE = 50;
const END_CURSOR = "__END__";
const MAX_CUSTOMER_FETCH_ROUNDS = 5;
const MAX_CUSTOMERS_TO_SCAN = MAX_CUSTOMER_FETCH_ROUNDS * DEFAULT_CUSTOMER_PAGE_SIZE;
const MAX_ORDERS_PER_CUSTOMER = 250;
const MAX_CUSTOMER_RANGE_DAYS = 365;

const ZERO_CUSTOMER_OVERVIEW = {
  totalCustomers: 0,
  newCustomers: 0,
  returningCustomers: 0,
  activeCustomers: 0,
  churnedCustomers: 0,
  avgLifetimeValue: 0,
  avgOrderValue: 0,
  avgOrdersPerCustomer: 0,
  customerAcquisitionCost: 0,
  churnRate: 0,
  repeatPurchaseRate: 0,
  periodCustomerCount: 0,
  prepaidRate: 0,
  abandonedCartCustomers: 0,
  abandonedRate: 0,
  changes: {
    totalCustomers: 0,
    newCustomers: 0,
    lifetimeValue: 0,
  },
} as const;

const DEFAULT_JOURNEY_STAGES = [
  {
    stage: "Awareness",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:eye-bold-duotone",
    color: "primary",
  },
  {
    stage: "Interest",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:heart-bold-duotone",
    color: "interest",
  },
  {
    stage: "Consideration",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:cart-bold-duotone",
    color: "warning",
  },
  {
    stage: "Purchase",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:bag-bold-duotone",
    color: "success",
  },
  {
    stage: "Retention",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:refresh-circle-bold-duotone",
    color: "retention",
  },
] satisfies Array<{
  stage: string;
  customers: number;
  percentage: number;
  avgDays: number;
  conversionRate: number;
  icon: string;
  color: string;
}>;

const customerListEntryValidator = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  avatar: v.optional(v.string()),
  status: v.string(),
  lifetimeValue: v.number(),
  orders: v.number(),
  avgOrderValue: v.number(),
  lastOrderDate: v.string(),
  firstOrderDate: v.string(),
  shopifyCreatedAt: v.string(),
  shopifyUpdatedAt: v.optional(v.string()),
  segment: v.string(),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  periodOrders: v.number(),
  periodRevenue: v.number(),
  isReturning: v.boolean(),
});

const customerListPaginationValidator = v.object({
  page: v.number(),
  pageSize: v.number(),
  total: v.number(),
  totalPages: v.number(),
});

const journeyStageValidator = v.object({
  stage: v.string(),
  customers: v.number(),
  percentage: v.number(),
  avgDays: v.number(),
  conversionRate: v.number(),
  icon: v.string(),
  color: v.string(),
  metaConversionRate: v.optional(v.number()),
});

type CustomerListEntry = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: string;
  lifetimeValue: number;
  orders: number;
  avgOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
  shopifyCreatedAt: string;
  shopifyUpdatedAt?: string;
  segment: string;
  city?: string;
  country?: string;
  periodOrders: number;
  periodRevenue: number;
  isReturning: boolean;
};

type CustomersCursorState = {
  lastCreatedAt: number | null;
  lastId: string | null;
  done: boolean;
  key: string;
};

function buildCustomersCursorKey(args: {
  dateRange: DateRange;
  status?: string;
  segment?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  pageSize: number;
}): string {
  return JSON.stringify({
    dateRange: args.dateRange,
    status: args.status ?? null,
    segment: args.segment ?? null,
    search: args.searchTerm ?? null,
    sortBy: args.sortBy ?? null,
    sortOrder: args.sortOrder ?? null,
    pageSize: args.pageSize,
  });
}

function encodeCustomersCursor(state: CustomersCursorState): string {
  if (state.done) {
    return END_CURSOR;
  }

  return JSON.stringify({
    lastCreatedAt: state.lastCreatedAt,
    lastId: state.lastId,
    done: state.done,
    key: state.key,
  });
}

function decodeCustomersCursor(cursor: string | null): CustomersCursorState | null {
  if (!cursor || cursor === END_CURSOR) {
    return null;
  }

  try {
    const parsed = JSON.parse(cursor) as Partial<CustomersCursorState>;

    const lastCreatedAt =
      typeof parsed.lastCreatedAt === "number" && Number.isFinite(parsed.lastCreatedAt)
        ? parsed.lastCreatedAt
        : null;
    const lastId = typeof parsed.lastId === "string" ? parsed.lastId : null;
    const done = typeof parsed.done === "boolean" ? parsed.done : false;
    const key = typeof parsed.key === "string" ? parsed.key : "";

    return {
      lastCreatedAt,
      lastId,
      done,
      key,
    } satisfies CustomersCursorState;
  } catch (error) {
    console.warn("Failed to decode customers cursor", error);
    return null;
  }
}

function sortCustomerEntries(
  entries: CustomerListEntry[],
  sortBy: string,
  sortOrder: "asc" | "desc",
): CustomerListEntry[] {
  const direction = sortOrder === "asc" ? 1 : -1;

  const compare = (a: CustomerListEntry, b: CustomerListEntry): number => {
    switch (sortBy) {
      case "lifetimeValue":
        return (a.lifetimeValue - b.lifetimeValue) * direction;
      case "orders":
        return (a.orders - b.orders) * direction;
      case "name":
        return direction === 1 ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      case "avgOrderValue":
        return (a.avgOrderValue - b.avgOrderValue) * direction;
      case "firstOrderDate":
        return (
          (new Date(a.firstOrderDate).getTime() - new Date(b.firstOrderDate).getTime()) *
          direction
        );
      default:
        return (
          (new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime()) * direction
        );
    }
  };

  return entries.sort((a, b) => compare(a, b));
}

/**
 * Get customer overview metrics
 */
export const getCustomerOverview = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalCustomers: v.number(),
      newCustomers: v.number(),
      returningCustomers: v.number(),
      activeCustomers: v.number(),
      churnedCustomers: v.number(),
      avgLifetimeValue: v.number(),
      avgOrderValue: v.number(),
      avgOrdersPerCustomer: v.number(),
      customerAcquisitionCost: v.number(),
      churnRate: v.number(),
      repeatPurchaseRate: v.number(),
      periodCustomerCount: v.number(),
      prepaidRate: v.number(),
      abandonedCartCustomers: v.number(),
      abandonedRate: v.number(),
      changes: v.object({
        totalCustomers: v.number(),
        newCustomers: v.number(),
        lifetimeValue: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);
    const dailyOverview = await loadCustomerOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    if (!dailyOverview) {
      return { ...ZERO_CUSTOMER_OVERVIEW };
    }

    return dailyOverview.metrics ?? { ...ZERO_CUSTOMER_OVERVIEW };
  },
});
export const getCustomerList = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
    paginationOpts: v.optional(paginationOptsValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("converted"),
        v.literal("abandoned_cart"),
      ),
    ),
  },
  returns: v.object({
    page: v.array(customerListEntryValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
    data: v.optional(v.array(customerListEntryValidator)),
    pagination: v.optional(customerListPaginationValidator),
    info: v.optional(
      v.object({
        pageSize: v.number(),
        returned: v.number(),
        hasMore: v.boolean(),
        truncated: v.optional(v.boolean()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);

    const requestedItems = Math.max(
      1,
      Math.min(
        args.paginationOpts?.numItems ?? args.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE,
        MAX_CUSTOMER_PAGE_SIZE,
      ),
    );
    const fallbackPage = Math.max(1, Math.floor(args.page ?? 1));

    if (!auth) {
      return {
        page: [],
        continueCursor: END_CURSOR,
        isDone: true,
        data: [],
        pagination: {
          page: fallbackPage,
          pageSize: requestedItems,
          total: 0,
          totalPages: 0,
        },
        info: {
          pageSize: requestedItems,
          returned: 0,
          hasMore: false,
        },
      };
    }

    const range = validateDateRange(args.dateRange ?? defaultDateRange());
    if (range.dayCount && range.dayCount > MAX_CUSTOMER_RANGE_DAYS) {
      throw new Error(`Date range too large. Please select ${MAX_CUSTOMER_RANGE_DAYS} days or fewer.`);
    }
    const timestamps = toTimestampRange(range);

    const cursorKey = buildCustomersCursorKey({
      dateRange: range,
      status: args.status,
      segment: args.segment,
      searchTerm: args.searchTerm,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      pageSize: requestedItems,
    });

    const decodedState = decodeCustomersCursor(args.paginationOpts?.cursor ?? null);
    const initialState = decodedState && decodedState.key === cursorKey ? decodedState : null;

    const sortBy = args.sortBy ?? "lastOrderDate";
    const sortOrder = args.sortOrder ?? "desc";
    const statusFilter = args.status ?? "all";
    const segmentFilter = args.segment && args.segment !== "all" ? args.segment : null;
    const searchTerm = args.searchTerm?.trim().toLowerCase() ?? null;

    const entries: CustomerListEntry[] = [];
    const seenIds = new Set<string>();

    let lastCreatedAt = initialState?.lastCreatedAt ?? null;
    let lastId = initialState?.lastId ?? null;
    let done = initialState?.done ?? false;

    const batchSize = Math.max(1, Math.min(requestedItems, MAX_CUSTOMER_PAGE_SIZE));
    let rounds = 0;
    let scannedCustomers = 0;
    let truncatedByScanLimit = false;

    while (entries.length < requestedItems && !done && rounds < MAX_CUSTOMER_FETCH_ROUNDS && scannedCustomers < MAX_CUSTOMERS_TO_SCAN) {
      rounds += 1;

      let baseQuery = ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization_and_created", (q) =>
          q.eq("organizationId", auth.orgId as Id<"organizations">),
        )
        .order("desc");

      if (lastCreatedAt !== null && lastId) {
        const cursorCreatedAt = lastCreatedAt;
        const cursorId = lastId;
        baseQuery = baseQuery.filter((q) =>
          q.or(
            q.lt(q.field("shopifyCreatedAt"), cursorCreatedAt),
            q.and(
              q.eq(q.field("shopifyCreatedAt"), cursorCreatedAt),
              q.lt(q.field("_id"), cursorId as Id<"shopifyCustomers">),
            ),
          ),
        );
      }

      const chunk = await baseQuery.take(batchSize);
      if (chunk.length === 0) {
        done = true;
        break;
      }

      scannedCustomers += chunk.length;

      let hitCapacity = false;

      for (const customer of chunk) {
        lastCreatedAt = customer.shopifyCreatedAt;
        lastId = customer._id as string;

        if (seenIds.has(customer._id as string)) {
          continue;
        }

        const name = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Anonymous";
        const normalizedEmail = (customer.email ?? "").toLowerCase();
        const normalizedName = name.toLowerCase();

        if (searchTerm && !normalizedName.includes(searchTerm) && !normalizedEmail.includes(searchTerm)) {
          continue;
        }

        const orders = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_customer", (q) =>
            q.eq("customerId", customer._id as Id<"shopifyCustomers">),
          )
          .filter((q) =>
            q.and(
              q.gte(q.field("shopifyCreatedAt"), timestamps.start),
              q.lte(q.field("shopifyCreatedAt"), timestamps.end),
            ),
          )
          .order("desc")
          .take(MAX_ORDERS_PER_CUSTOMER);

        const validOrders = orders.filter((order) => order.financialStatus !== "cancelled");

        const lifetimeValue = validOrders.reduce((sum, order) => sum + order.totalPrice, 0);
        const orderCount = validOrders.length;
        const avgOrderValue = orderCount > 0 ? lifetimeValue / orderCount : 0;

        const orderTimestamps = validOrders
          .map((order) => order.shopifyCreatedAt)
          .sort((a, b) => a - b);

        const firstOrderTimestamp = orderTimestamps[0];
        const lastOrderTimestamp = orderTimestamps[orderTimestamps.length - 1];

        const firstOrderDate = firstOrderTimestamp
          ? new Date(firstOrderTimestamp).toISOString()
          : new Date(timestamps.start).toISOString();
        const lastOrderDate = lastOrderTimestamp
          ? new Date(lastOrderTimestamp).toISOString()
          : new Date(timestamps.start).toISOString();

        const shopifyCreatedAtIso = new Date(
          customer.shopifyCreatedAt ?? customer.syncedAt ?? Date.now(),
        ).toISOString();
        const shopifyUpdatedAtIso = customer.shopifyUpdatedAt
          ? new Date(customer.shopifyUpdatedAt).toISOString()
          : undefined;

        let segment = "prospect";
        if (orderCount === 1) {
          segment = "new";
        } else if (orderCount >= 2 && lifetimeValue < 500) {
          segment = "regular";
        } else if (orderCount >= 2 && lifetimeValue >= 500 && lifetimeValue < 1000) {
          segment = "vip";
        } else if (orderCount >= 2 && lifetimeValue >= 1000) {
          segment = "champion";
        }

        if (segmentFilter && segment !== segmentFilter) {
          continue;
        }

        const convertedStatus = orderCount > 0 ? "converted" : "abandoned_cart";
        if (statusFilter === "converted" && convertedStatus !== "converted") {
          continue;
        }
        if (statusFilter === "abandoned_cart" && convertedStatus !== "abandoned_cart") {
          continue;
        }

        const entry: CustomerListEntry = {
          id: customer._id as string,
          name,
          email: customer.email ?? "",
          avatar: undefined,
          status: convertedStatus,
          lifetimeValue,
          orders: orderCount,
          avgOrderValue,
          lastOrderDate,
          firstOrderDate,
          shopifyCreatedAt: shopifyCreatedAtIso,
          shopifyUpdatedAt: shopifyUpdatedAtIso,
          segment,
          city: customer.defaultAddress?.city,
          country: customer.defaultAddress?.country,
          periodOrders: orderCount,
          periodRevenue: lifetimeValue,
          isReturning: orderCount > 1,
        } satisfies CustomerListEntry;

        entries.push(entry);
        seenIds.add(entry.id);

        if (entries.length >= requestedItems) {
          hitCapacity = true;
          break;
        }
      }

      if (hitCapacity) {
        done = false;
        break;
      }

      if (chunk.length < batchSize) {
        done = true;
      }

      if (scannedCustomers >= MAX_CUSTOMERS_TO_SCAN) {
        truncatedByScanLimit = true;
        done = false;
        break;
      }
    }

    const sortedEntries = sortCustomerEntries(entries, sortBy, sortOrder);
    const pageEntries = sortedEntries.slice(0, requestedItems);

    const hasMore = truncatedByScanLimit || !done;

    const continueCursor = hasMore && lastCreatedAt !== null && lastId
      ? encodeCustomersCursor({
          lastCreatedAt,
          lastId,
          done: false,
          key: cursorKey,
        })
      : END_CURSOR;

    return {
      page: pageEntries,
      continueCursor,
      isDone: !hasMore,
      data: pageEntries,
      info: {
        pageSize: requestedItems,
        returned: pageEntries.length,
        hasMore,
        ...(truncatedByScanLimit ? { truncated: true } : {}),
      },
    };
  },
});

/**
 * Get customer journey funnel
 */
export const getCustomerJourney = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.array(journeyStageValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return DEFAULT_JOURNEY_STAGES;

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);

    // Load customer overview from daily metrics to get aggregated data
    const dailyOverview = await loadCustomerOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    if (!dailyOverview?.metrics) {
      return DEFAULT_JOURNEY_STAGES;
    }

    const metrics = dailyOverview.metrics;
    const returningCustomers = metrics.returningCustomers || 0;

    // Sum Meta insights incrementally to avoid fetching a giant array
    let metaTotals = { impressions: 0, clicks: 0, conversions: 0 } as {
      impressions: number;
      clicks: number;
      conversions: number;
    };
    let mCursor: string | null = null;
    const M_PAGE = 250;
    while (true) {
      const page = await ctx.db
        .query("metaInsights")
        .withIndex("by_org_date", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("date", range.startDate)
            .lte("date", range.endDate),
        )
        .paginate({ numItems: M_PAGE, cursor: mCursor });

      for (const insight of page.page) {
        if ((insight as any).entityType !== "account") continue;
        const impressions = typeof (insight as any).impressions === "number" ? (insight as any).impressions : 0;
        const clicks = typeof (insight as any).clicks === "number" ? (insight as any).clicks : 0;
        const conversions = typeof (insight as any).conversions === "number" ? (insight as any).conversions : 0;
        metaTotals = {
          impressions: metaTotals.impressions + Math.max(impressions, 0),
          clicks: metaTotals.clicks + Math.max(clicks, 0),
          conversions: metaTotals.conversions + Math.max(conversions, 0),
        };
      }

      if (page.isDone || !page.continueCursor) break;
      mCursor = page.continueCursor;
    }

    const roundPercent = (value: number) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      const clamped = Math.min(100, Math.max(0, value));
      return Number.parseFloat(clamped.toFixed(2));
    };

    const awarenessCustomers = Math.max(metaTotals.impressions, 0);
    const interestCustomers = Math.max(metaTotals.clicks, 0);
    const metaConversionRate = interestCustomers > 0
      ? roundPercent((metaTotals.conversions / interestCustomers) * 100)
      : 0;

    const considerationCustomers = Math.max(
      (metrics.abandonedCartCustomers || 0) + (metrics.periodCustomerCount || 0),
      0,
    );
    const purchaseCustomers = Math.max(metrics.periodCustomerCount || 0, 0);
    const retentionCustomers = Math.max(returningCustomers, 0);

    const baseForPercentage = (() => {
      if (awarenessCustomers > 0) return awarenessCustomers;
      if (interestCustomers > 0) return interestCustomers;
      if (considerationCustomers > 0) return considerationCustomers;
      if (purchaseCustomers > 0) return purchaseCustomers;
      if (retentionCustomers > 0) return retentionCustomers;
      return 1;
    })();

    const toPercentage = (value: number) =>
      baseForPercentage > 0
        ? roundPercent((value / baseForPercentage) * 100)
        : 0;

    const awarenessToInterest = awarenessCustomers > 0
      ? roundPercent((interestCustomers / awarenessCustomers) * 100)
      : 0;
    const interestToConsideration = interestCustomers > 0
      ? roundPercent((considerationCustomers / interestCustomers) * 100)
      : 0;
    const considerationToPurchase = considerationCustomers > 0
      ? roundPercent((purchaseCustomers / considerationCustomers) * 100)
      : 0;
    const purchaseToRetention = purchaseCustomers > 0
      ? roundPercent((retentionCustomers / purchaseCustomers) * 100)
      : 0;

    return [
      {
        stage: "Awareness",
        customers: awarenessCustomers,
        percentage: awarenessCustomers > 0 ? 100 : toPercentage(awarenessCustomers),
        avgDays: 0,
        conversionRate: awarenessToInterest,
        icon: "solar:eye-bold-duotone",
        color: "primary",
      },
      {
        stage: "Interest",
        customers: interestCustomers,
        percentage: toPercentage(interestCustomers),
        avgDays: 0,
        conversionRate: interestToConsideration,
        icon: "solar:heart-bold-duotone",
        color: "interest",
        metaConversionRate,
      },
      {
        stage: "Consideration",
        customers: considerationCustomers,
        percentage: toPercentage(considerationCustomers),
        avgDays: 0,
        conversionRate: considerationToPurchase,
        icon: "solar:cart-bold-duotone",
        color: "warning",
      },
      {
        stage: "Purchase",
        customers: purchaseCustomers,
        percentage: toPercentage(purchaseCustomers),
        avgDays: 0,
        conversionRate: purchaseToRetention,
        icon: "solar:bag-bold-duotone",
        color: "success",
      },
      {
        stage: "Retention",
        customers: retentionCustomers,
        percentage: toPercentage(retentionCustomers),
        avgDays: 0,
        conversionRate: 0,
        icon: "solar:refresh-circle-bold-duotone",
        color: "retention",
      },
    ];
  },
});
