import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { action, query } from "../_generated/server";
import { api } from "../_generated/api";
import { validateDateRange, toTimestampRange, type DateRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { loadCustomerOverviewFromDailyMetrics } from "../utils/dailyMetrics";
import { dateRangeValidator, defaultDateRange } from "./analyticsShared";

const MAX_CUSTOMER_PAGE_SIZE = 100;
const DEFAULT_CUSTOMER_PAGE_SIZE = 50;
const END_CURSOR = "__END__";

type DateRangeArg = DateRange;

type CustomersCursorState = {
  offset: number;
  key: string;
};

function buildCustomersCursorKey(args: {
  dateRange: DateRangeArg;
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
  if (state.offset < 0) {
    return END_CURSOR;
  }
  return JSON.stringify(state);
}

function decodeCustomersCursor(cursor: string | null): CustomersCursorState | null {
  if (!cursor || cursor === END_CURSOR) {
    return null;
  }

  try {
    const parsed = JSON.parse(cursor) as Partial<CustomersCursorState>;
    const offset = typeof parsed.offset === "number" ? parsed.offset : 0;
    const key = typeof parsed.key === "string" ? parsed.key : "";
    return {
      offset: Math.max(0, Math.floor(offset)),
      key,
    } satisfies CustomersCursorState;
  } catch (error) {
    console.warn("Failed to decode customers cursor", error);
    return null;
  }
}

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
  periodRepeatRate: 0,
  abandonedCartCustomers: 0,
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
    color: "secondary",
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
    color: "info",
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
  segment: v.string(),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  periodOrders: v.optional(v.number()),
  periodRevenue: v.optional(v.number()),
  isReturning: v.optional(v.boolean()),
});

const customerListPaginationValidator = v.object({
  page: v.number(),
  pageSize: v.number(),
  total: v.number(),
  totalPages: v.number(),
});

const customerListResultValidator = v.object({
  data: v.array(customerListEntryValidator),
  pagination: customerListPaginationValidator,
  continueCursor: v.string(),
  info: v.optional(
    v.object({
      pageSize: v.number(),
      returned: v.number(),
      hasMore: v.boolean(),
    }),
  ),
});

const cohortValidator = v.object({
  cohort: v.string(),
  cohortSize: v.number(),
  periods: v.array(
    v.object({
      period: v.number(),
      retained: v.number(),
      percentage: v.number(),
      revenue: v.number(),
    }),
  ),
});

const geographicValidator = v.object({
  countries: v.array(
    v.object({
      country: v.string(),
      customers: v.number(),
      revenue: v.number(),
      orders: v.number(),
      avgOrderValue: v.number(),
      zipCodes: v.array(
        v.object({
          zipCode: v.string(),
          city: v.optional(v.string()),
          customers: v.number(),
          revenue: v.number(),
        }),
      ),
    }),
  ),
  cities: v.array(
    v.object({
      city: v.string(),
      country: v.string(),
      customers: v.number(),
      revenue: v.number(),
    }),
  ),
  heatmapData: v.array(
    v.object({
      lat: v.number(),
      lng: v.number(),
      value: v.number(),
    }),
  ),
});

const journeyStageValidator = v.object({
  stage: v.string(),
  customers: v.number(),
  percentage: v.number(),
  avgDays: v.number(),
  conversionRate: v.number(),
  icon: v.string(),
  color: v.string(),
});

const overviewValidator = v.union(
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
    periodRepeatRate: v.number(),
    abandonedCartCustomers: v.number(),
    changes: v.object({
      totalCustomers: v.number(),
      newCustomers: v.number(),
      lifetimeValue: v.number(),
    }),
  }),
);

const customerAnalyticsResultValidator = v.object({
  overview: overviewValidator,
  cohorts: v.array(cohortValidator),
  customerList: v.union(v.null(), customerListResultValidator),
  geographic: v.union(v.null(), geographicValidator),
  journey: v.array(journeyStageValidator),
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
  segment: string;
  city?: string;
  country?: string;
  periodOrders: number;
  periodRevenue: number;
  isReturning: boolean;
};

type CustomerListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CustomerAnalyticsResult = {
  overview: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    activeCustomers: number;
    churnedCustomers: number;
    avgLifetimeValue: number;
    avgOrderValue: number;
    avgOrdersPerCustomer: number;
    customerAcquisitionCost: number;
    churnRate: number;
    repeatPurchaseRate: number;
    periodCustomerCount: number;
    prepaidRate: number;
    periodRepeatRate: number;
    abandonedCartCustomers: number;
    changes: {
      totalCustomers: number;
      newCustomers: number;
      lifetimeValue: number;
    };
  } | null;
  cohorts: Array<{
    cohort: string;
    cohortSize: number;
    periods: Array<{
      period: number;
      retained: number;
      percentage: number;
      revenue: number;
    }>;
  }>;
  customerList: {
    data: CustomerListEntry[];
    pagination: CustomerListPagination;
    continueCursor: string;
  } | null;
  geographic: {
    countries: Array<{
      country: string;
      customers: number;
      revenue: number;
      orders: number;
      avgOrderValue: number;
      zipCodes: Array<{
        zipCode: string;
        city?: string;
        customers: number;
        revenue: number;
      }>;
    }>;
    cities: Array<{
      city: string;
      country: string;
      customers: number;
      revenue: number;
    }>;
    heatmapData: Array<{ lat: number; lng: number; value: number }>;
  } | null;
  journey: Array<{
    stage: string;
    customers: number;
    percentage: number;
    avgDays: number;
    conversionRate: number;
    icon: string;
    color: string;
  }>;
};

/**
 * Customer Analytics API
 * Provides comprehensive customer insights and segmentation
 */

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
      periodRepeatRate: v.number(),
      abandonedCartCustomers: v.number(),
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
/**
 * Get RFM (Recency, Frequency, Monetary) segments
 */
export const getRFMSegments = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      count: v.number(),
      percentage: v.number(),
      avgLTV: v.number(),
      description: v.string(),
      recommendation: v.string(),
      color: v.string(),
      icon: v.string(),
    }),
  ),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    return [];
  },
});
/**
 * Get cohort analysis data
 */
export const getCohortAnalysis = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
    cohortType: v.optional(v.union(v.literal("monthly"), v.literal("weekly"))),
  },
  returns: v.array(
    v.object({
      cohort: v.string(),
      cohortSize: v.number(),
      periods: v.array(
        v.object({
          period: v.number(),
          retained: v.number(),
          percentage: v.number(),
          revenue: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);
    const timestamps = toTimestampRange(range);

    // Get all orders for this organization up to the end of the date range
    const allOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .lte("shopifyCreatedAt", timestamps.end),
      )
      .filter((q) => q.neq(q.field("financialStatus"), "cancelled"))
      .collect();

    // Group orders by customer and find first purchase month
    const customerCohorts = new Map<
      string,
      { cohortMonth: string; orders: Array<{ date: Date; amount: number }> }
    >();

    for (const order of allOrders) {
      if (!order.customerId) continue;

      const orderDate = new Date(order.shopifyCreatedAt);
      const customerId = order.customerId;

      if (!customerCohorts.has(customerId)) {
        customerCohorts.set(customerId, {
          cohortMonth: "",
          orders: [],
        });
      }

      const customerData = customerCohorts.get(customerId)!;
      customerData.orders.push({
        date: orderDate,
        amount: order.totalPrice,
      });
    }

    // Determine cohort month (first purchase) for each customer
    for (const [_customerId, data] of customerCohorts.entries()) {
      data.orders.sort((a, b) => a.date.getTime() - b.date.getTime());
      const firstOrder = data.orders[0];
      if (firstOrder) {
        const cohortDate = firstOrder.date;
        data.cohortMonth = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, "0")}`;
      }
    }

    // Group by cohort
    const cohorts = new Map<
      string,
      {
        customers: Set<string>;
        ordersByPeriod: Map<number, { customers: Set<string>; revenue: number }>;
      }
    >();

    for (const [customerId, data] of customerCohorts.entries()) {
      const cohortMonth = data.cohortMonth;
      if (!cohortMonth) continue;

      if (!cohorts.has(cohortMonth)) {
        cohorts.set(cohortMonth, {
          customers: new Set(),
          ordersByPeriod: new Map(),
        });
      }

      const cohort = cohorts.get(cohortMonth)!;
      cohort.customers.add(customerId);

      // Calculate period (months since cohort) for each order
      const [cohortYear, cohortMonthNum] = cohortMonth.split("-").map(Number);
      for (const order of data.orders) {
        const orderYear = order.date.getFullYear();
        const orderMonth = order.date.getMonth() + 1;

        const period =
          (orderYear - cohortYear!) * 12 + (orderMonth - cohortMonthNum!);

        if (!cohort.ordersByPeriod.has(period)) {
          cohort.ordersByPeriod.set(period, {
            customers: new Set(),
            revenue: 0,
          });
        }

        const periodData = cohort.ordersByPeriod.get(period)!;
        periodData.customers.add(customerId);
        periodData.revenue += order.amount;
      }
    }

    // Build cohort analysis result
    const cohortResults = Array.from(cohorts.entries())
      .map(([cohortMonth, cohortData]) => {
        const cohortSize = cohortData.customers.size;
        const periods = Array.from(cohortData.ordersByPeriod.entries())
          .sort(([a], [b]) => a - b)
          .slice(0, 12) // Limit to 12 periods
          .map(([period, data]) => ({
            period,
            retained: data.customers.size,
            percentage: cohortSize > 0 ? (data.customers.size / cohortSize) * 100 : 0,
            revenue: data.revenue,
          }));

        return {
          cohort: cohortMonth,
          cohortSize,
          periods,
        };
      })
      .sort((a, b) => b.cohort.localeCompare(a.cohort)) // Most recent first
      .slice(0, 12); // Last 12 cohorts

    return cohortResults;
  },
});

/**
 * Get paginated customer list
 */
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
    page: v.array(
      v.object({
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
        segment: v.string(),
        city: v.optional(v.string()),
        country: v.optional(v.string()),
        periodOrders: v.number(),
        periodRevenue: v.number(),
        isReturning: v.boolean(),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
    data: v.optional(
      v.array(
        v.object({
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
          segment: v.string(),
          city: v.optional(v.string()),
          country: v.optional(v.string()),
          periodOrders: v.number(),
          periodRevenue: v.number(),
          isReturning: v.boolean(),
        }),
      ),
    ),
    pagination: v.optional(
      v.object({
        page: v.number(),
        pageSize: v.number(),
        total: v.number(),
        totalPages: v.number(),
      }),
    ),
    info: v.optional(
      v.object({
        pageSize: v.number(),
        returned: v.number(),
        hasMore: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const pageSize = Math.max(
      1,
      Math.min(args.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE, MAX_CUSTOMER_PAGE_SIZE),
    );
    const page = Math.max(1, Math.floor(args.page ?? 1));

    if (!auth) {
      return {
        page: [],
        continueCursor: END_CURSOR,
        isDone: true,
        data: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Parse and validate date range
    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);
    const timestamps = toTimestampRange(range);
    // Get all orders within the date range for this organization
    const ordersInRange = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .gte("shopifyCreatedAt", timestamps.start)
          .lte("shopifyCreatedAt", timestamps.end),
      )
      .filter((q) => q.neq(q.field("financialStatus"), "cancelled"))
      .collect();

    // Get unique customers who had orders in this period
    const customerIdsInPeriod = new Set<string>();
    const ordersByCustomer = new Map<string, typeof ordersInRange>();
    for (const order of ordersInRange) {
      const customerId = order.customerId;
      if (!customerId) {
        continue;
      }
      customerIdsInPeriod.add(customerId);
      const existingOrders = ordersByCustomer.get(customerId);
      if (existingOrders) {
        existingOrders.push(order);
      } else {
        ordersByCustomer.set(customerId, [order]);
      }
    }

    // Get customer documents
    const allCustomers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const statusFilter = args.status ?? "all";

    // Only constrain to in-period customers when the requested status demands it
    let filteredCustomers = allCustomers;
    if (statusFilter === "converted") {
      filteredCustomers = filteredCustomers.filter((c) => customerIdsInPeriod.has(c._id));
    }

    // Apply search term filter if provided
    const searchTerm = args.searchTerm?.trim().toLowerCase();
    if (searchTerm) {
      filteredCustomers = filteredCustomers.filter((c) => {
        const name = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
        const email = (c.email || "").toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    // Build customer list with order aggregations
    const customerDataPromises = filteredCustomers.map(async (customer) => {
      // Get orders for this customer in the date range
      const orders = ordersByCustomer.get(customer._id) ?? [];

      const lifetimeValue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
      const orderCount = orders.length;
      const avgOrderValue = orderCount > 0 ? lifetimeValue / orderCount : 0;

      // Get first and last order dates from the filtered orders
      const orderDates = orders
        .map((o) => o.shopifyCreatedAt)
        .sort((a, b) => a - b);
      const firstOrderTimestamp = orderDates[0];
      const lastOrderTimestamp = orderDates[orderDates.length - 1];

      const firstOrderDate = firstOrderTimestamp
        ? new Date(firstOrderTimestamp).toISOString()
        : new Date(timestamps.start).toISOString();
      const lastOrderDate = lastOrderTimestamp
        ? new Date(lastOrderTimestamp).toISOString()
        : new Date(timestamps.start).toISOString();

      // Determine segment based on LTV and order count
      let segment = "new";
      if (orderCount === 0) {
        segment = "prospect";
      } else if (orderCount === 1) {
        segment = "new";
      } else if (orderCount >= 2 && lifetimeValue < 500) {
        segment = "regular";
      } else if (orderCount >= 2 && lifetimeValue >= 500 && lifetimeValue < 1000) {
        segment = "vip";
      } else if (lifetimeValue >= 1000) {
        segment = "champion";
      }

      // Determine status (currently unused, may be needed for future features)
      const daysSinceLastOrder = lastOrderTimestamp
        ? Math.max(0, (timestamps.end - lastOrderTimestamp) / (1000 * 60 * 60 * 24))
        : 0;
      let _status = "active";
      if (orderCount === 0) {
        _status = "prospect";
      } else if (daysSinceLastOrder > 180) {
        _status = "churned";
      } else if (daysSinceLastOrder > 90) {
        _status = "at-risk";
      }

      const name = `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Anonymous";

      const periodRevenue = lifetimeValue;
      const periodOrders = orderCount;
      const isReturning = orderCount > 1;
      const convertedStatus = periodOrders > 0 ? "converted" : "abandoned_cart";

      return {
        id: customer._id,
        name,
        email: customer.email || "",
        avatar: undefined,
        status: convertedStatus,
        lifetimeValue,
        orders: orderCount,
        avgOrderValue,
        lastOrderDate,
        firstOrderDate,
        segment,
        city: customer.defaultAddress?.city,
        country: customer.defaultAddress?.country,
        periodOrders,
        periodRevenue,
        isReturning,
      } satisfies CustomerListEntry;
    });

    const customerData = await Promise.all(customerDataPromises);

    let finalData = customerData;
    if (statusFilter === "converted") {
      finalData = finalData.filter((c) => c.periodOrders > 0);
    } else if (statusFilter === "abandoned_cart") {
      finalData = finalData.filter((c) => c.periodOrders === 0);
    }

    if (args.segment && args.segment !== "all") {
      finalData = finalData.filter((c) => c.segment === args.segment);
    }

    // Sort data
    const sortBy = args.sortBy || "lastOrderDate";
    const sortOrder = args.sortOrder || "desc";
    finalData.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortBy) {
        case "lifetimeValue":
          aVal = a.lifetimeValue;
          bVal = b.lifetimeValue;
          break;
        case "orders":
          aVal = a.orders;
          bVal = b.orders;
          break;
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        default:
          aVal = new Date(a.lastOrderDate).getTime();
          bVal = new Date(b.lastOrderDate).getTime();
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    const requestedItems = Math.max(
      1,
      Math.min(
        args.paginationOpts?.numItems ??
          Math.max(
            1,
            Math.min(args.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE, MAX_CUSTOMER_PAGE_SIZE),
          ),
        MAX_CUSTOMER_PAGE_SIZE,
      ),
    );

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

    const fallbackPage = Math.max(1, Math.floor(args.page ?? 1));
    let offset = initialState?.offset ?? (fallbackPage - 1) * requestedItems;
    offset = Math.max(0, offset);

    const total = finalData.length;
    if (offset >= total) {
      offset = Math.max(0, Math.floor((total - 1) / requestedItems) * requestedItems);
    }

    const endIdx = Math.min(total, offset + requestedItems);
    const sliced = finalData.slice(offset, endIdx);
    const nextOffset = offset + sliced.length;
    const hasMore = nextOffset < total;
    const continueCursor = hasMore
      ? encodeCustomersCursor({ offset: nextOffset, key: cursorKey })
      : END_CURSOR;

    const pageNumber = total === 0 ? 1 : Math.floor(offset / requestedItems) + 1;
    const totalPages = Math.max(1, Math.ceil(Math.max(1, total) / requestedItems));

    return {
      page: sliced,
      continueCursor,
      isDone: !hasMore,
      data: sliced,
      pagination: {
        page: Math.min(pageNumber, totalPages),
        pageSize: requestedItems,
        total,
        totalPages,
      },
      info: {
        pageSize: requestedItems,
        returned: sliced.length,
        hasMore,
      },
    };
  },
});

/**
 * Get customer segments for dashboard widget
 */
export const getCustomerSegments = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.object({
    totalCustomers: v.number(),
    returningCustomers: v.number(),
    vipCustomers: v.number(),
    atRiskCustomers: v.number(),
  }),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        totalCustomers: 0,
        returningCustomers: 0,
        vipCustomers: 0,
        atRiskCustomers: 0,
      };
    }

    return {
      totalCustomers: 0,
      returningCustomers: 0,
      vipCustomers: 0,
      atRiskCustomers: 0,
    };
  },
});

/**
 * Get geographic distribution
 */
export const getGeographicDistribution = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: geographicValidator,
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        countries: [],
        cities: [],
        heatmapData: [],
      };
    }

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);
    const timestamps = toTimestampRange(range);

    // Get orders in the date range
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .gte("shopifyCreatedAt", timestamps.start)
          .lte("shopifyCreatedAt", timestamps.end),
      )
      .filter((q) => q.neq(q.field("financialStatus"), "cancelled"))
      .collect();

    // Get unique customer IDs from orders
    const customerIds = new Set<string>();
    for (const order of orders) {
      if (order.customerId) {
        customerIds.add(order.customerId);
      }
    }

    // Get customer documents
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Build geographic aggregations
    const countryMap = new Map<
      string,
      {
        customers: Set<string>;
        revenue: number;
        orders: number;
        cities: Map<string, { customers: Set<string>; revenue: number }>;
        zipCodes: Map<string, { customers: Set<string>; revenue: number; city?: string }>;
      }
    >();

    for (const customer of customers) {
      if (!customerIds.has(customer._id)) continue;
      if (!customer.defaultAddress?.country) continue;

      const country = customer.defaultAddress.country;
      const city = customer.defaultAddress.city;
      const zip = customer.defaultAddress.zip;

      if (!countryMap.has(country)) {
        countryMap.set(country, {
          customers: new Set(),
          revenue: 0,
          orders: 0,
          cities: new Map(),
          zipCodes: new Map(),
        });
      }

      const countryData = countryMap.get(country)!;
      countryData.customers.add(customer._id);

      // Add city data
      if (city) {
        if (!countryData.cities.has(city)) {
          countryData.cities.set(city, { customers: new Set(), revenue: 0 });
        }
        countryData.cities.get(city)!.customers.add(customer._id);
      }

      // Add zip data
      if (zip) {
        if (!countryData.zipCodes.has(zip)) {
          countryData.zipCodes.set(zip, { customers: new Set(), revenue: 0, city });
        }
        countryData.zipCodes.get(zip)!.customers.add(customer._id);
      }
    }

    // Aggregate revenue from orders
    for (const order of orders) {
      if (!order.customerId) continue;
      if (!order.shippingAddress?.country) continue;

      const country = order.shippingAddress.country;
      if (countryMap.has(country)) {
        const countryData = countryMap.get(country)!;
        countryData.revenue += order.totalPrice;
        countryData.orders += 1;

        // Add to city revenue
        const city = order.shippingAddress.city;
        if (city && countryData.cities.has(city)) {
          countryData.cities.get(city)!.revenue += order.totalPrice;
        }

        // Add to zip revenue
        const zip = order.shippingAddress.zip;
        if (zip && countryData.zipCodes.has(zip)) {
          countryData.zipCodes.get(zip)!.revenue += order.totalPrice;
        }
      }
    }

    // Build result arrays
    const countries = Array.from(countryMap.entries()).map(([country, data]) => ({
      country,
      customers: data.customers.size,
      revenue: data.revenue,
      orders: data.orders,
      avgOrderValue: data.orders > 0 ? data.revenue / data.orders : 0,
      zipCodes: Array.from(data.zipCodes.entries()).map(([zipCode, zipData]) => ({
        zipCode,
        city: zipData.city,
        customers: zipData.customers.size,
        revenue: zipData.revenue,
      })),
    }));

    const cities = Array.from(countryMap.entries()).flatMap(([country, data]) =>
      Array.from(data.cities.entries()).map(([city, cityData]) => ({
        city,
        country,
        customers: cityData.customers.size,
        revenue: cityData.revenue,
      })),
    );

    return {
      countries,
      cities,
      heatmapData: [], // TODO: Implement heatmap coordinates
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
    const totalCustomers = metrics.totalCustomers || 0;
    const activeCustomers = metrics.activeCustomers || 0;
    const newCustomers = metrics.newCustomers || 0;
    const returningCustomers = metrics.returningCustomers || 0;

    // Calculate journey stages based on metrics
    const awarenessCustomers = totalCustomers;
    const considerationCustomers = activeCustomers; // Customers who purchased
    const purchaseCustomers = newCustomers + returningCustomers;
    const retentionCustomers = returningCustomers;

    // Calculate conversion rates
    const awarenessToConsideration = awarenessCustomers > 0
      ? (considerationCustomers / awarenessCustomers) * 100
      : 0;
    const considerationToPurchase = considerationCustomers > 0
      ? (purchaseCustomers / considerationCustomers) * 100
      : 0;
    const purchaseToRetention = purchaseCustomers > 0
      ? (retentionCustomers / purchaseCustomers) * 100
      : 0;

    return [
      {
        stage: "Awareness",
        customers: awarenessCustomers,
        percentage: 100,
        avgDays: 0,
        conversionRate: awarenessToConsideration,
        icon: "solar:eye-bold-duotone",
        color: "primary",
      },
      {
        stage: "Consideration",
        customers: considerationCustomers,
        percentage: awarenessCustomers > 0 ? (considerationCustomers / awarenessCustomers) * 100 : 0,
        avgDays: 0,
        conversionRate: considerationToPurchase,
        icon: "solar:cart-bold-duotone",
        color: "warning",
      },
      {
        stage: "Purchase",
        customers: purchaseCustomers,
        percentage: awarenessCustomers > 0 ? (purchaseCustomers / awarenessCustomers) * 100 : 0,
        avgDays: 0,
        conversionRate: purchaseToRetention,
        icon: "solar:bag-bold-duotone",
        color: "success",
      },
      {
        stage: "Retention",
        customers: retentionCustomers,
        percentage: awarenessCustomers > 0 ? (retentionCustomers / awarenessCustomers) * 100 : 0,
        avgDays: 0,
        conversionRate: 0,
        icon: "solar:refresh-circle-bold-duotone",
        color: "info",
      },
    ];
  },
});

export const getAnalytics = action({
  args: {
    dateRange: dateRangeValidator,
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
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
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
      organizationId: v.string(),
      result: customerAnalyticsResultValidator,
    }),
  ),
  handler: async (ctx, args): Promise<
    | {
        dateRange: { startDate: string; endDate: string };
        organizationId: string;
        result: CustomerAnalyticsResult;
      }
    | null
  > => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);

    const [overview, cohorts, geographic, journey] = await Promise.all([
      ctx.runQuery(api.web.customers.getCustomerOverview, {
        dateRange: range,
      }),
      ctx.runQuery(api.web.customers.getCohortAnalysis, {
        dateRange: range,
        cohortType: "monthly",
      }),
      ctx.runQuery(api.web.customers.getGeographicDistribution, {
        dateRange: range,
      }),
      ctx.runQuery(api.web.customers.getCustomerJourney, {
        dateRange: range,
      }),
    ]);

    const customerListPayload = null;

    return {
      dateRange: range,
      organizationId: auth.orgId,
      result: {
        overview: overview ?? null,
        cohorts: cohorts ?? null,
        geographic: geographic ?? null,
        journey: journey ?? null,
        customerList: customerListPayload,
      },
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      result: CustomerAnalyticsResult;
    };
  },
});
