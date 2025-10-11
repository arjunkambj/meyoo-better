import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  validateDateRange,
  toTimestampRange,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import {
  DEFAULT_JOURNEY_STAGES,
  loadCustomerJourneyStages,
} from "../utils/customerJourney";
import { loadCustomerOverviewFromDailyMetrics } from "../utils/dailyMetrics";
import { dateRangeValidator, defaultDateRange } from "./analyticsShared";

const MAX_CUSTOMER_PAGE_SIZE = 50;
const DEFAULT_CUSTOMER_PAGE_SIZE = 50;
const END_CURSOR = "__END__";
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

    const sortBy = args.sortBy ?? "lastOrderDate";
    const sortOrder = args.sortOrder ?? "desc";
    const statusFilter = args.status ?? "all";
    const segmentFilter = args.segment && args.segment !== "all" ? args.segment : null;
    const searchTerm = args.searchTerm?.trim().toLowerCase() ?? null;

    // Step 1: Fetch orders in date range using the efficient index
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .gte("shopifyCreatedAt", timestamps.start)
          .lte("shopifyCreatedAt", timestamps.end),
      )
      .collect();

    // Step 2: Group orders by customerId and calculate metrics
    interface CustomerMetrics {
      orders: typeof orders;
      validOrders: typeof orders;
      lifetimeValue: number;
      orderCount: number;
      avgOrderValue: number;
      firstOrderTimestamp: number | null;
      lastOrderTimestamp: number | null;
      isReturning: boolean;
    }

    const customerMetricsMap = new Map<string, CustomerMetrics>();

    for (const order of orders) {
      if (!order.customerId) continue;

      const customerId = order.customerId as string;
      const isCancelled = order.financialStatus === "cancelled";

      if (!customerMetricsMap.has(customerId)) {
        customerMetricsMap.set(customerId, {
          orders: [],
          validOrders: [],
          lifetimeValue: 0,
          orderCount: 0,
          avgOrderValue: 0,
          firstOrderTimestamp: null,
          lastOrderTimestamp: null,
          isReturning: false,
        });
      }

      const metrics = customerMetricsMap.get(customerId)!;
      metrics.orders.push(order);

      if (!isCancelled) {
        metrics.validOrders.push(order);
        metrics.lifetimeValue += order.totalPrice;
        metrics.orderCount += 1;

        if (metrics.firstOrderTimestamp === null || order.shopifyCreatedAt < metrics.firstOrderTimestamp) {
          metrics.firstOrderTimestamp = order.shopifyCreatedAt;
        }
        if (metrics.lastOrderTimestamp === null || order.shopifyCreatedAt > metrics.lastOrderTimestamp) {
          metrics.lastOrderTimestamp = order.shopifyCreatedAt;
        }
      }
    }

    // Calculate avg order values and isReturning
    for (const metrics of customerMetricsMap.values()) {
      metrics.avgOrderValue = metrics.orderCount > 0 ? metrics.lifetimeValue / metrics.orderCount : 0;
      metrics.isReturning = metrics.orderCount > 1;
    }

    // Step 3: Fetch customer details for customers with orders in the period
    const customerIds = Array.from(customerMetricsMap.keys());
    const customerDocs = await Promise.all(
      customerIds.map((id) => ctx.db.get(id as Id<"shopifyCustomers">)),
    );

    // Step 4: Build customer entries
    const allEntries: CustomerListEntry[] = [];

    for (const customer of customerDocs) {
      if (!customer) continue;

      const metrics = customerMetricsMap.get(customer._id as string);
      if (!metrics) continue;

      const name = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Anonymous";
      const normalizedEmail = (customer.email ?? "").toLowerCase();
      const normalizedName = name.toLowerCase();

      // Apply search filter
      if (searchTerm && !normalizedName.includes(searchTerm) && !normalizedEmail.includes(searchTerm)) {
        continue;
      }

      // Determine segment
      const orderCount = metrics.orderCount;
      const lifetimeValue = metrics.lifetimeValue;
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

      // Apply segment filter
      if (segmentFilter && segment !== segmentFilter) {
        continue;
      }

      // Determine status
      const convertedStatus = orderCount > 0 ? "converted" : "abandoned_cart";

      // Apply status filter
      if (statusFilter === "converted" && convertedStatus !== "converted") {
        continue;
      }
      if (statusFilter === "abandoned_cart" && convertedStatus !== "abandoned_cart") {
        continue;
      }

      const firstOrderDate = metrics.firstOrderTimestamp
        ? new Date(metrics.firstOrderTimestamp).toISOString()
        : new Date(timestamps.start).toISOString();
      const lastOrderDate = metrics.lastOrderTimestamp
        ? new Date(metrics.lastOrderTimestamp).toISOString()
        : new Date(timestamps.start).toISOString();

      const shopifyCreatedAtIso = new Date(
        customer.shopifyCreatedAt ?? customer.syncedAt ?? Date.now(),
      ).toISOString();
      const shopifyUpdatedAtIso = customer.shopifyUpdatedAt
        ? new Date(customer.shopifyUpdatedAt).toISOString()
        : undefined;

      const entry: CustomerListEntry = {
        id: customer._id as string,
        name,
        email: customer.email ?? "",
        avatar: undefined,
        status: convertedStatus,
        lifetimeValue: metrics.lifetimeValue,
        orders: metrics.orderCount,
        avgOrderValue: metrics.avgOrderValue,
        lastOrderDate,
        firstOrderDate,
        shopifyCreatedAt: shopifyCreatedAtIso,
        shopifyUpdatedAt: shopifyUpdatedAtIso,
        segment,
        city: customer.defaultAddress?.city,
        country: customer.defaultAddress?.country,
        periodOrders: metrics.orderCount,
        periodRevenue: metrics.lifetimeValue,
        isReturning: metrics.isReturning,
      } satisfies CustomerListEntry;

      allEntries.push(entry);
    }

    // Step 5: Sort entries
    const sortedEntries = sortCustomerEntries(allEntries, sortBy, sortOrder);

    // Step 6: Paginate
    const page = fallbackPage;
    const startIndex = (page - 1) * requestedItems;
    const endIndex = startIndex + requestedItems;
    const pageEntries = sortedEntries.slice(startIndex, endIndex);

    const total = sortedEntries.length;
    const totalPages = Math.max(1, Math.ceil(total / requestedItems));
    const hasMore = page < totalPages;

    return {
      page: pageEntries,
      continueCursor: hasMore ? `page_${page + 1}` : END_CURSOR,
      isDone: !hasMore,
      data: pageEntries,
      pagination: {
        page,
        pageSize: requestedItems,
        total,
        totalPages,
      },
      info: {
        pageSize: requestedItems,
        returned: pageEntries.length,
        hasMore,
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
    if (!auth) return [...DEFAULT_JOURNEY_STAGES];

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);

    const journey = await loadCustomerJourneyStages(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    return journey;
  },
});
