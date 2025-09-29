import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { action, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { getUserAndOrg } from "../utils/auth";

const MAX_CUSTOMER_PAGE_SIZE = 100;
const MAX_CURSOR_CARRY = 100;
const END_CURSOR = "__END__";

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
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
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
    const orgId = auth.orgId;
    const periodRange = normalizeDateRange(args.dateRange ?? undefined);
    const hasPeriod = periodRange !== undefined;

    // Get all customers for the organization
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Get orders based on date range
    let orders: Doc<"shopifyOrders">[] = [];
    let filteredOrders: Doc<"shopifyOrders">[] = [];

    if (args.dateRange) {
      const startDate = new Date(args.dateRange.startDate).getTime();
      const endDate = new Date(`${args.dateRange.endDate}T23:59:59`).getTime();

      // Use index for date range filtering
      orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", orgId)
            .gte("shopifyCreatedAt", startDate)
            .lte("shopifyCreatedAt", endDate),
        )
        .collect();

      filteredOrders = orders;

      // Also get all orders for lifetime calculations
      const allOrders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();

      // Use allOrders for lifetime metrics
      orders = allOrders;
    } else {
      // Get all orders for the organization
      orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();

      filteredOrders = orders;
    }

    // Group orders by customer
    const customerOrdersMap = new Map<string, typeof orders>();

    for (const order of orders) {
      if (order.customerId) {
        if (!customerOrdersMap.has(order.customerId)) {
          customerOrdersMap.set(order.customerId, []);
        }
        customerOrdersMap.get(order.customerId)?.push(order);
      }
    }

    // Calculate metrics from actual data
    const customerMetrics = customers.map((customer) => {
      const customerOrders = customerOrdersMap.get(customer._id) || [];
      // Find orders in period using ID comparison instead of filter
      const filteredOrderIds = new Set(filteredOrders.map((o) => o._id));
      const ordersInPeriod = customerOrders.filter((o) =>
        filteredOrderIds.has(o._id),
      );

      const lifetimeValue = customerOrders.reduce(
        (sum, o) => sum + (o.totalPrice || 0),
        0,
      );
      const lifetimeOrders = customerOrders.length;
      const avgOrderValue =
        lifetimeOrders > 0 ? lifetimeValue / lifetimeOrders : 0;

      // Get first and last order dates
      const sortedOrders = [...customerOrders].sort(
        (a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt,
      );
      const firstOrderDate = sortedOrders[0]?.shopifyCreatedAt;
      const lastOrderDate =
        sortedOrders[sortedOrders.length - 1]?.shopifyCreatedAt;

      return {
        ...customer,
        lifetimeValue,
        lifetimeOrders,
        avgOrderValue,
        firstOrderDate: firstOrderDate
          ? new Date(firstOrderDate).toISOString().split("T")[0]
          : "",
        lastOrderDate: lastOrderDate
          ? new Date(lastOrderDate).toISOString().split("T")[0]
          : "",
        ordersInPeriod: ordersInPeriod.length,
        revenueInPeriod: ordersInPeriod.reduce(
          (sum, o) => sum + (o.totalPrice || 0),
          0,
        ),
      };
    });

    // Get customers who had activity in the period if date range provided
    let filteredCustomers = customerMetrics;

    if (args.dateRange) {
      // Only include customers with orders in the period
      filteredCustomers = customerMetrics.filter((c) => c.ordersInPeriod > 0);
    }

    // Calculate metrics
    const totalCustomers = customers.length; // Total customers in system
    // Calculate customer segments
    const customersWithOrders: typeof customerMetrics = [];
    let newCustomers = 0;
    let returningCustomers = 0;

    for (const c of customerMetrics) {
      if (c.lifetimeOrders > 0) {
        customersWithOrders.push(c);
        if (c.lifetimeOrders === 1) {
          newCustomers++;
        } else {
          returningCustomers++;
        }
      }
    }

    // Calculate active and churned customers
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let activeCustomers = 0;
    let churnedCustomers = 0;

    for (const c of customersWithOrders) {
      const lastOrderTimestamp = c.lastOrderDate
        ? new Date(c.lastOrderDate).getTime()
        : 0;

      if (lastOrderTimestamp >= thirtyDaysAgo) {
        activeCustomers++;
      } else if (lastOrderTimestamp < ninetyDaysAgo && lastOrderTimestamp > 0) {
        churnedCustomers++;
      }
    }

    // Calculate averages from customers with orders
    const totalLTV = customersWithOrders.reduce(
      (sum, c) => sum + (c.lifetimeValue || 0),
      0,
    );
    const totalOrders = customersWithOrders.reduce(
      (sum, c) => sum + (c.lifetimeOrders || 0),
      0,
    );
    const avgLifetimeValue =
      customersWithOrders.length > 0
        ? totalLTV / customersWithOrders.length
        : 0;
    const avgOrderValue = totalOrders > 0 ? totalLTV / totalOrders : 0;
    const avgOrdersPerCustomer =
      customersWithOrders.length > 0
        ? totalOrders / customersWithOrders.length
        : 0;

    // Calculate Customer Acquisition Cost (simplified for now)
    // In production, this would come from ad spend / new customers
    const avgCAC = avgLifetimeValue * 0.3; // Assume 30% of LTV as CAC

    // Calculate rates
    const churnRate =
      customersWithOrders.length > 0
        ? (churnedCustomers / customersWithOrders.length) * 100
        : 0;
    const repeatPurchaseRate =
      customersWithOrders.length > 0
        ? (returningCustomers / customersWithOrders.length) * 100
        : 0;

    const customersWithOrdersInPeriod = hasPeriod
      ? customerMetrics.filter((c) => c.ordersInPeriod > 0)
      : customersWithOrders;

    const repeatCustomersInPeriod = hasPeriod
      ? customersWithOrdersInPeriod.filter((c) => c.ordersInPeriod >= 2)
      : customersWithOrders.filter((c) => c.lifetimeOrders >= 2);

    const periodCustomerCount = customersWithOrdersInPeriod.length;

    const customersCreatedInPeriod = hasPeriod
      ? customerMetrics.filter((c) => {
          const createdAt =
            typeof c.shopifyCreatedAt === "number" ? c.shopifyCreatedAt : null;

          return (
            createdAt != null &&
            isTimestampInRange(createdAt, periodRange as TimestampRange)
          );
        })
      : customerMetrics;

    const abandonedCartCustomers = hasPeriod
      ? customersCreatedInPeriod.filter((c) => c.ordersInPeriod === 0).length
      : totalCustomers - customersWithOrders.length;

    const prepaidOrdersCount = filteredOrders.filter((order) => {
      const status = order.financialStatus?.toLowerCase();

      return status === "paid" || status === "partially_paid";
    }).length;

    const prepaidRate =
      filteredOrders.length > 0
        ? (prepaidOrdersCount / filteredOrders.length) * 100
        : 0;

    const periodRepeatRate =
      periodCustomerCount > 0
        ? (repeatCustomersInPeriod.length / periodCustomerCount) * 100
        : 0;

    // Calculate changes from previous period
    const changes = {
      totalCustomers: 0,
      newCustomers: 0,
      lifetimeValue: 0,
    };

    // If we have a date range, calculate changes from previous period
    if (args.dateRange) {
      const currentStart = new Date(args.dateRange.startDate).getTime();
      const currentEnd = new Date(args.dateRange.endDate).getTime();
      const periodLength = currentEnd - currentStart;

      // Get previous period orders using index
      const previousOrders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("shopifyCreatedAt", currentStart - periodLength)
            .lt("shopifyCreatedAt", currentStart),
        )
        .collect();

      // Calculate previous period metrics
      const prevCustomersWithOrders = new Set(
        previousOrders.map((o) => o.customerId).filter(Boolean),
      ).size;

      const prevNewCustomers = previousOrders.filter((o) => {
        if (!o.customerId) return false;
        const customerOrders = customerOrdersMap.get(o.customerId);

        return (
          customerOrders &&
          customerOrders.filter((co) => co.shopifyCreatedAt < currentStart)
            .length === 1
        );
      }).length;

      const prevLTV =
        previousOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0) /
        (prevCustomersWithOrders || 1);

      // Calculate percentage changes
      changes.totalCustomers =
        prevCustomersWithOrders > 0
          ? ((filteredCustomers.length - prevCustomersWithOrders) /
              prevCustomersWithOrders) *
            100
          : 0;
      changes.newCustomers =
        prevNewCustomers > 0
          ? ((newCustomers - prevNewCustomers) / prevNewCustomers) * 100
          : 0;
      changes.lifetimeValue =
        prevLTV > 0 ? ((avgLifetimeValue - prevLTV) / prevLTV) * 100 : 0;
    }

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      activeCustomers,
      churnedCustomers,
      avgLifetimeValue,
      avgOrderValue,
        avgOrdersPerCustomer,
        customerAcquisitionCost: avgCAC,
        churnRate,
        repeatPurchaseRate,
        periodCustomerCount,
        prepaidRate,
        periodRepeatRate,
        abandonedCartCustomers,
        changes,
      };
  },
});

/**
 * Get RFM (Recency, Frequency, Monetary) segments
 */
export const getRFMSegments = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
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

    // Get all customers and their orders
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Group orders by customer
    const customerOrdersMap = new Map<string, typeof orders>();

    for (const order of orders) {
      if (order.customerId) {
        if (!customerOrdersMap.has(order.customerId)) {
          customerOrdersMap.set(order.customerId, []);
        }
        customerOrdersMap.get(order.customerId)?.push(order);
      }
    }

    // Calculate RFM scores for each customer with orders
    const now = Date.now();
    const scoredCustomers = customers
      .filter((c) => customerOrdersMap.has(c._id))
      .map((customer) => {
        const customerOrders = customerOrdersMap.get(customer._id) || [];

        // Sort orders by date
        const sortedOrders = [...customerOrders].sort(
          (a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt,
        );

        const lastOrder = sortedOrders[sortedOrders.length - 1];
        const lifetimeValue = customerOrders.reduce(
          (sum, o) => sum + (o.totalPrice || 0),
          0,
        );
        const lifetimeOrders = customerOrders.length;

        // Recency score (days since last order)
        const daysSinceLastOrder = Math.floor(
          (now - (lastOrder?.shopifyCreatedAt ?? now)) / (1000 * 60 * 60 * 24),
        );
        const recencyScore =
          daysSinceLastOrder <= 30
            ? 5
            : daysSinceLastOrder <= 60
              ? 4
              : daysSinceLastOrder <= 90
                ? 3
                : daysSinceLastOrder <= 180
                  ? 2
                  : 1;

        // Frequency score (number of orders)
        const frequencyScore =
          lifetimeOrders >= 10
            ? 5
            : lifetimeOrders >= 5
              ? 4
              : lifetimeOrders >= 3
                ? 3
                : lifetimeOrders >= 2
                  ? 2
                  : 1;

        // Monetary score (lifetime value)
        const monetaryScore =
          lifetimeValue >= 5000
            ? 5
            : lifetimeValue >= 2000
              ? 4
              : lifetimeValue >= 1000
                ? 3
                : lifetimeValue >= 500
                  ? 2
                  : 1;

        return {
          ...customer,
          lifetimeValue,
          lifetimeOrders,
          recencyScore,
          frequencyScore,
          monetaryScore,
          rfmScore: recencyScore + frequencyScore + monetaryScore,
        };
      });

    // Segment customers based on RFM scores
    const segments = [
      {
        name: "Champions",
        filter: (c: {
          recencyScore: number;
          frequencyScore: number;
          monetaryScore: number;
        }) =>
          c.recencyScore >= 4 && c.frequencyScore >= 4 && c.monetaryScore >= 4,
        description: "Bought recently, buy often, spend the most",
        recommendation: "Reward them. Can be early adopters for new products",
        color: "success",
        icon: "solar:crown-bold-duotone",
      },
      {
        name: "Loyal Customers",
        filter: (c: {
          recencyScore: number;
          frequencyScore: number;
          monetaryScore: number;
        }) => c.frequencyScore >= 3 && c.monetaryScore >= 3,
        description: "Spend good money. Responsive to promotions",
        recommendation: "Upsell higher value products. Ask for reviews",
        color: "primary",
        icon: "solar:heart-bold-duotone",
      },
      {
        name: "Potential Loyalists",
        filter: (c: {
          recencyScore: number;
          frequencyScore: number;
          monetaryScore: number;
        }) => c.recencyScore >= 3 && c.frequencyScore >= 2,
        description:
          "Recent customers, spent good amount, bought more than once",
        recommendation: "Offer membership/loyalty program, recommend products",
        color: "secondary",
        icon: "solar:star-bold-duotone",
      },
      {
        name: "New Customers",
        filter: (c: {
          recencyScore: number;
          frequencyScore: number;
          monetaryScore: number;
        }) => c.recencyScore >= 4 && c.frequencyScore === 1,
        description: "Bought recently, but only once",
        recommendation: "Provide onboarding support, give them early success",
        color: "info",
        icon: "solar:user-bold-duotone",
      },
      {
        name: "At Risk",
        filter: (c: {
          recencyScore: number;
          frequencyScore: number;
          monetaryScore: number;
        }) => c.recencyScore <= 2 && c.frequencyScore >= 3,
        description: "Spent big money, but long time ago",
        recommendation: "Send personalized emails to reconnect, offer renewals",
        color: "warning",
        icon: "solar:danger-triangle-bold-duotone",
      },
      {
        name: "Can't Lose Them",
        filter: (c: {
          recencyScore: number;
          frequencyScore: number;
          monetaryScore: number;
        }) => c.recencyScore <= 2 && c.monetaryScore >= 4,
        description: "Made big purchases and often, but long time ago",
        recommendation: "Win them back via renewals or newer products",
        color: "danger",
        icon: "solar:close-circle-bold-duotone",
      },
    ];

    // Calculate segment metrics
    const totalCustomers = scoredCustomers.length;
    const segmentData = segments.map((segment) => {
      const segmentCustomers = scoredCustomers.filter(segment.filter);
      const count = segmentCustomers.length;
      const avgLTV =
        count > 0
          ? segmentCustomers.reduce((sum, c) => sum + c.lifetimeValue, 0) /
            count
          : 0;

      return {
        name: segment.name,
        count,
        percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0,
        avgLTV,
        description: segment.description,
        recommendation: segment.recommendation,
        color: segment.color,
        icon: segment.icon,
      };
    });

    return segmentData.filter((s) => s.count > 0);
  },
});

/**
 * Get cohort analysis data
 */
export const getCohortAnalysis = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
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

    const organizationId = auth.orgId as Id<"organizations">;

    // Load orders scoped to the requested window (default: all time)
    let orders: Doc<"shopifyOrders">[];

    if (args.dateRange) {
      const startTime = new Date(args.dateRange.startDate).getTime();
      const endTime =
        new Date(args.dateRange.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

      orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", organizationId)
            .gte("shopifyCreatedAt", startTime)
            .lte("shopifyCreatedAt", endTime),
        )
        .collect();
    } else {
      orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();
    }

    if (orders.length === 0) {
      return [];
    }

    // Get customers linked to the organization
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Group orders by customer
    const customerOrdersMap = new Map<string, typeof orders>();

    for (const order of orders) {
      if (order.customerId) {
        if (!customerOrdersMap.has(order.customerId)) {
          customerOrdersMap.set(order.customerId, []);
        }
        customerOrdersMap.get(order.customerId)?.push(order);
      }
    }

    // Group customers by acquisition month (first order month)
    interface CohortCustomer extends Doc<"shopifyCustomers"> {
      orders: Doc<"shopifyOrders">[];
      firstOrderDate: string;
      ordersCount: number;
    }
    const cohortMap = new Map<string, CohortCustomer[]>();

    customers.forEach((customer) => {
      const customerOrders = customerOrdersMap.get(customer._id);

      if (!customerOrders || customerOrders.length === 0) return;

      // Sort orders within the selected period to find the first occurrence
      const sortedOrders = [...customerOrders].sort(
        (a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt,
      );
      const firstOrder = sortedOrders[0]!;
      const cohortMonth = new Date(firstOrder.shopifyCreatedAt)
        .toISOString()
        .substring(0, 7); // YYYY-MM

      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, []);
      }
      const cohortCustomer: CohortCustomer = {
        ...customer,
        orders: customerOrders,
        firstOrderDate: new Date(firstOrder.shopifyCreatedAt).toISOString(),
        ordersCount: customerOrders.length,
      };
      cohortMap.get(cohortMonth)?.push(cohortCustomer);
    });

    // Calculate retention for each cohort
    const cohortData = Array.from(cohortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 cohorts
      .map(([cohort, cohortCustomers]) => {
        const cohortSize = cohortCustomers.length;
        const cohortDate = new Date(`${cohort}-01`);

        // Calculate retention for each period
        const periods = [];

        for (let period = 0; period < 6; period++) {
          const periodDate = new Date(cohortDate);

          periodDate.setMonth(periodDate.getMonth() + period);
          const periodStart = periodDate.getTime();
          const periodEnd = new Date(periodDate);

          periodEnd.setMonth(periodEnd.getMonth() + 1);

          // Count customers who made purchases in this period
          const retained = cohortCustomers.filter((c) => {
            // Check if customer has any order in this period
            return c.orders.some(
              (order: Doc<"shopifyOrders">) =>
                order.shopifyCreatedAt >= periodStart &&
                order.shopifyCreatedAt < periodEnd.getTime(),
            );
          }).length;

          // Calculate revenue for this period from actual orders
          const revenue = cohortCustomers.reduce((sum, c) => {
            const periodRevenue = c.orders
              .filter(
                (order: Doc<"shopifyOrders">) =>
                  order.shopifyCreatedAt >= periodStart &&
                  order.shopifyCreatedAt < periodEnd.getTime(),
              )
              .reduce(
                (orderSum: number, order: Doc<"shopifyOrders">) =>
                  orderSum + (order.totalPrice || 0),
                0,
              );

            return sum + periodRevenue;
          }, 0);

          periods.push({
            period,
            retained,
            percentage: cohortSize > 0 ? (retained / cohortSize) * 100 : 0,
            revenue,
          });
        }

        return {
          cohort,
          cohortSize,
          periods,
        };
      });

    return cohortData;
  },
});

/**
 * Get paginated customer list
 */
export const getCustomerList = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
    paginationOpts: v.optional(paginationOptsValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
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
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        page: [],
        continueCursor: END_CURSOR,
        isDone: true,
        data: [],
        pagination: {
          page: 1,
          pageSize: 0,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const orgId = auth.orgId as Id<"organizations">;
    const dateRange = normalizeDateRange(args.dateRange ?? undefined);
    const isLegacyRequest = !args.paginationOpts;
    const legacyPage = Math.max(1, Math.floor(args.page ?? 1));
    const requestedItems = args.paginationOpts?.numItems ?? args.pageSize ?? 50;
    const pageSize = Math.max(
      1,
      Math.min(requestedItems, MAX_CUSTOMER_PAGE_SIZE),
    );
    const targetOffset = isLegacyRequest ? (legacyPage - 1) * pageSize : 0;
    const cursorState = decodeCustomerCursor(args.paginationOpts?.cursor ?? null);
    const sortByField = args.sortBy;
    const sortOrder = args.sortOrder ?? "desc";

    const searchTerm =
      args.searchTerm && args.searchTerm.trim().length > 0
        ? args.searchTerm.trim().toLowerCase()
        : undefined;

    if (isLegacyRequest) {
      return handleLegacyCustomerList(ctx, {
        orgId,
        dateRange,
        page: legacyPage,
        pageSize,
        searchTerm,
        segment: args.segment,
        sortBy: sortByField,
        sortOrder,
      });
    }

    const results: {
      id: string;
      name: string;
      email: string;
      avatar: string | undefined;
      status: string;
      lifetimeValue: number;
      orders: number;
      avgOrderValue: number;
      lastOrderDate: string;
      firstOrderDate: string;
      segment: string;
      city?: string;
      country?: string;
    }[] = [];

    let nextCarry: string[] = [];
    let nextDbCursor: string | null = cursorState.dbCursor ?? null;
    let skipped = 0;

    const addCustomer = async (
      customer: Doc<"shopifyCustomers">,
    ): Promise<void> => {
      if (results.length >= pageSize) {
        return;
      }

      if (customer.organizationId !== orgId) {
        return;
      }

      if (searchTerm) {
        const fullName = `${customer.firstName ?? ""} ${
          customer.lastName ?? ""
        }`
          .trim()
          .toLowerCase();
        const email = (customer.email ?? "").toLowerCase();

        if (
          !fullName.includes(searchTerm) &&
          !email.includes(searchTerm)
        ) {
          return;
        }
      }

      const orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_customer", (q) =>
          q.eq("customerId", customer._id as Id<"shopifyCustomers">),
        )
        .collect();

      const sortedOrders = orders
        .slice()
        .sort((a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt);

      const ordersInRange = dateRange
        ? sortedOrders.filter((order) =>
            isTimestampInRange(order.shopifyCreatedAt, dateRange),
          )
        : sortedOrders;

      if (dateRange && ordersInRange.length === 0) {
        return;
      }

      const metricsOrders = ordersInRange;
      const totalValue = metricsOrders.reduce(
        (sum, order) => sum + (order.totalPrice ?? 0),
        0,
      );
      const orderCount = metricsOrders.length;
      const avgOrderValue =
        orderCount > 0 ? totalValue / orderCount : 0;

      const firstOrder = metricsOrders[0];
      const lastOrder = metricsOrders[orderCount - 1];

      const lifetimeOrders = sortedOrders.length;
      const lifetimeLastOrder =
        sortedOrders[sortedOrders.length - 1] ?? null;

      const segment = determineSegment(
        lifetimeOrders,
        lifetimeLastOrder
          ? new Date(lifetimeLastOrder.shopifyCreatedAt)
          : null,
      );

      if (args.segment && args.segment !== segment) {
        return;
      }

      if (skipped < targetOffset) {
        skipped += 1;
        return;
      }

      const status = lifetimeOrders > 0 ? "converted" : "abandoned_cart";

      results.push({
        id: customer._id,
        name:
          `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
          "Unknown",
        email: customer.email ?? "",
        avatar: undefined,
        status,
        lifetimeValue: totalValue,
        orders: orderCount,
        avgOrderValue,
        lastOrderDate: lastOrder
          ? new Date(lastOrder.shopifyCreatedAt)
              .toISOString()
              .substring(0, 10)
          : "",
        firstOrderDate: firstOrder
          ? new Date(firstOrder.shopifyCreatedAt)
              .toISOString()
              .substring(0, 10)
          : "",
        segment,
        city: customer.defaultAddress?.city,
        country: customer.defaultAddress?.country,
      });
    };

    if (cursorState.carryIds.length > 0) {
      for (let index = 0; index < cursorState.carryIds.length; index += 1) {
        if (results.length >= pageSize) {
          nextCarry = cursorState.carryIds.slice(index);
          break;
        }

        const carryId = cursorState.carryIds[index]!;
        const customerDoc = await ctx.db.get(
          carryId as Id<"shopifyCustomers">,
        );

        if (!customerDoc) {
          continue;
        }

        await addCustomer(customerDoc);
      }

      if (results.length >= pageSize || nextCarry.length > 0) {
        const continueCursor = encodeCustomerCursor({
          dbCursor: cursorState.dbCursor ?? null,
          carryIds: nextCarry,
        });

        if (sortByField) {
          const direction = sortOrder === "asc" ? 1 : -1;
          results.sort((a, b) => {
            const aVal = a[sortByField as keyof typeof a];
            const bVal = b[sortByField as keyof typeof b];

            if (aVal === undefined || bVal === undefined) {
              return 0;
            }

            if (aVal === bVal) return 0;
            return aVal > bVal ? direction : -direction;
          });
        }

        const legacyData =
          isLegacyRequest
            ? results.map((customer) => ({
                id: customer.id,
                name: customer.name,
                email: customer.email,
                avatar: customer.avatar,
                status: customer.status,
                lifetimeValue: customer.lifetimeValue,
                orders: customer.orders,
                avgOrderValue: customer.avgOrderValue,
                lastOrderDate: customer.lastOrderDate,
                firstOrderDate: customer.firstOrderDate,
                segment: customer.segment,
                city: customer.city,
                country: customer.country,
              }))
            : undefined;

        const legacyPagination = isLegacyRequest
          ? {
              page: legacyPage,
              pageSize,
              total:
                targetOffset +
                results.length +
                (continueCursor === END_CURSOR ? 0 : pageSize),
              totalPages:
                results.length === 0
                  ? legacyPage
                  : Math.max(
                      legacyPage,
                      Math.ceil(
                        (targetOffset + results.length +
                          (continueCursor === END_CURSOR ? 0 : pageSize)) /
                          pageSize,
                      ),
                    ),
            }
          : undefined;

        return {
          page: results,
          continueCursor,
          isDone: continueCursor === END_CURSOR,
          data: legacyData,
          pagination: legacyPagination,
        };
      }
    }

    const paginated = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .paginate({
        cursor: cursorState.dbCursor ?? null,
        numItems: Math.min(pageSize, MAX_CUSTOMER_PAGE_SIZE),
      });

    nextDbCursor = paginated.isDone ? null : paginated.continueCursor;

    for (let i = 0; i < paginated.page.length; i += 1) {
      if (results.length >= pageSize) {
        nextCarry = paginated.page.slice(i).map((customer) => customer._id);
        break;
      }

      const customerDoc = paginated.page[i]!;

      await addCustomer(customerDoc);
    }

    const continueCursor = encodeCustomerCursor({
      dbCursor: nextDbCursor,
      carryIds: nextCarry,
    });

    if (sortByField) {
      const direction = sortOrder === "asc" ? 1 : -1;
      results.sort((a, b) => {
        const aVal = a[sortByField as keyof typeof a];
        const bVal = b[sortByField as keyof typeof b];

        if (aVal === undefined || bVal === undefined) {
          return 0;
        }

        if (aVal === bVal) return 0;
        return aVal > bVal ? direction : -direction;
      });
    }

    const legacyData =
      isLegacyRequest
        ? results.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            avatar: customer.avatar,
            status: customer.status,
            lifetimeValue: customer.lifetimeValue,
            orders: customer.orders,
            avgOrderValue: customer.avgOrderValue,
            lastOrderDate: customer.lastOrderDate,
            firstOrderDate: customer.firstOrderDate,
            segment: customer.segment,
            city: customer.city,
            country: customer.country,
          }))
        : undefined;

    const legacyPagination = isLegacyRequest
      ? {
          page: legacyPage,
          pageSize,
          total:
            targetOffset +
            results.length +
            (continueCursor === END_CURSOR ? 0 : pageSize),
          totalPages:
            results.length === 0
              ? legacyPage
              : Math.max(
                  legacyPage,
                  Math.ceil(
                    (targetOffset + results.length +
                      (continueCursor === END_CURSOR ? 0 : pageSize)) /
                      pageSize,
                  ),
                ),
        }
      : undefined;

    return {
      page: results,
      continueCursor,
      isDone: continueCursor === END_CURSOR,
      data: legacyData,
      pagination: legacyPagination,
    };
  },
});

interface LegacyCustomerListArgs {
  orgId: Id<"organizations">;
  dateRange?: TimestampRange;
  page: number;
  pageSize: number;
  searchTerm?: string;
  segment?: string;
  sortBy?: string;
  sortOrder: "asc" | "desc";
}

async function handleLegacyCustomerList(
  ctx: QueryCtx,
  {
    orgId,
    dateRange,
    page,
    pageSize,
    searchTerm,
    segment,
    sortBy,
    sortOrder,
  }: LegacyCustomerListArgs,
) {
  const customers = await ctx.db
    .query("shopifyCustomers")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();

  const orders = await ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();

  const customerOrdersMap = new Map<string, typeof orders>();

  for (const order of orders) {
    if (!order.customerId) continue;
    if (!customerOrdersMap.has(order.customerId)) {
      customerOrdersMap.set(order.customerId, []);
    }
    customerOrdersMap.get(order.customerId)!.push(order);
  }

  const mergedData = customers.map((customer) => {
    const customerOrders = customerOrdersMap.get(customer._id) ?? [];

    const lifetimeValue = customerOrders.reduce(
      (sum, o) => sum + (o.totalPrice || 0),
      0,
    );
    const lifetimeOrders = customerOrders.length;
    const avgOrderValue = lifetimeOrders > 0 ? lifetimeValue / lifetimeOrders : 0;

    const sortedOrders = [...customerOrders].sort(
      (a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt,
    );
    const firstOrder = sortedOrders[0];
    const lastOrder = sortedOrders[sortedOrders.length - 1];

    const ordersInRange = dateRange
      ? customerOrders.filter((order) =>
          isTimestampInRange(order.shopifyCreatedAt, dateRange),
        )
      : customerOrders;

    const segmentValue = determineSegment(
      lifetimeOrders,
      lastOrder ? new Date(lastOrder.shopifyCreatedAt) : null,
    );

    return {
      id: customer._id,
      name: `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
        "Unknown",
      email: customer.email ?? "",
      avatar: undefined,
      status: lifetimeOrders > 0 ? "converted" : "abandoned_cart",
      lifetimeValue,
      orders: ordersInRange.length,
      avgOrderValue,
      lastOrderDate: lastOrder
        ? new Date(lastOrder.shopifyCreatedAt).toISOString().substring(0, 10)
        : "",
      firstOrderDate: firstOrder
        ? new Date(firstOrder.shopifyCreatedAt).toISOString().substring(0, 10)
        : "",
      segment: segmentValue,
      city: customer.defaultAddress?.city,
      country: customer.defaultAddress?.country,
    };
  });

  let filteredData = mergedData;

  if (searchTerm) {
    filteredData = filteredData.filter((c) => {
      const name = c.name.toLowerCase();
      const email = c.email.toLowerCase();
      return name.includes(searchTerm) || email.includes(searchTerm);
    });
  }

  if (segment) {
    filteredData = filteredData.filter((c) => c.segment === segment);
  }

  if (sortBy) {
    const direction = sortOrder === "asc" ? 1 : -1;
    filteredData = [...filteredData].sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a];
      const bVal = b[sortBy as keyof typeof b];

      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal === bVal) return 0;
      return aVal > bVal ? direction : -direction;
    });
  }

  const total = filteredData.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const startIndex = (safePage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  return {
    page: paginatedData,
    continueCursor: END_CURSOR,
    isDone: true,
    data: paginatedData,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };
}

// Customer pagination helpers
type CustomerCursorState = {
  dbCursor: string | null;
  carryIds: string[];
};

type TimestampRange = {
  start: number;
  end: number;
};

function normalizeDateRange(
  range?: { startDate: string; endDate: string },
): TimestampRange | undefined {
  if (!range) return undefined;

  const start = new Date(range.startDate).getTime();
  const endExclusive = new Date(range.endDate).getTime() + 24 * 60 * 60 * 1000;

  if (Number.isNaN(start) || Number.isNaN(endExclusive)) {
    return undefined;
  }

  return {
    start,
    end: endExclusive - 1,
  };
}

function isTimestampInRange(timestamp: number, range: TimestampRange): boolean {
  return timestamp >= range.start && timestamp <= range.end;
}

function decodeCustomerCursor(cursor: string | null): CustomerCursorState {
  if (!cursor || cursor === END_CURSOR) {
    return { dbCursor: null, carryIds: [] };
  }

  try {
    const parsed = JSON.parse(cursor) as Partial<CustomerCursorState>;

    if (
      parsed &&
      (typeof parsed.dbCursor === "string" || parsed.dbCursor === null) &&
      Array.isArray(parsed.carryIds)
    ) {
      const carry = parsed.carryIds
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .slice(0, MAX_CURSOR_CARRY);

      return {
        dbCursor: parsed.dbCursor ?? null,
        carryIds: carry,
      };
    }
  } catch (_error) {
    // Fallback to treat the cursor as a raw Convex cursor
  }

  return { dbCursor: cursor, carryIds: [] };
}

function encodeCustomerCursor(state: CustomerCursorState): string {
  const carry = state.carryIds
    .filter((id) => typeof id === "string" && id.length > 0)
    .slice(0, MAX_CURSOR_CARRY);
  const dbCursor = typeof state.dbCursor === "string" ? state.dbCursor : null;

  if (dbCursor === null && carry.length === 0) {
    return END_CURSOR;
  }

  return JSON.stringify({
    dbCursor,
    carryIds: carry,
  });
}

// Helper function to determine customer segment
function determineSegment(
  lifetimeOrders: number,
  _lastOrder: Date | null,
): string {
  // Simple segmentation: new (1 order) or repeated (2+ orders)
  if (lifetimeOrders === 0) return "new"; // No orders yet
  if (lifetimeOrders === 1) return "new";

  return "repeated";
}

/**
 * Get customer segments for dashboard widget
 */
export const getCustomerSegments = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalCustomers: v.number(),
      returningCustomers: v.number(),
      vipCustomers: v.number(),
      atRiskCustomers: v.number(),
    }),
  ),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Get all customers for the organization
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Get all orders to calculate segments
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Date range filtering is not used in this function

    // Group orders by customer
    const customerOrdersMap = new Map<string, typeof orders>();

    for (const order of orders) {
      if (order.customerId) {
        if (!customerOrdersMap.has(order.customerId)) {
          customerOrdersMap.set(order.customerId, []);
        }
        customerOrdersMap.get(order.customerId)?.push(order);
      }
    }

    // Calculate segments based on actual customer behavior
    let totalCustomers = 0;
    let returningCustomers = 0;
    let vipCustomers = 0;
    let atRiskCustomers = 0;

    const now = Date.now();

    for (const customer of customers) {
      const customerOrders = customerOrdersMap.get(customer._id) || [];

      // Skip customers with no orders
      if (customerOrders.length === 0) continue;

      totalCustomers++;

      // Calculate metrics for segmentation
      const lifetimeValue = customerOrders.reduce(
        (sum, o) => sum + (o.totalPrice || 0),
        0,
      );
      const lifetimeOrders = customerOrders.length;

      // Get last order date
      const sortedOrders = [...customerOrders].sort(
        (a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt,
      );
      const lastOrder = sortedOrders[sortedOrders.length - 1];
      const daysSinceLastOrder = Math.floor(
        (now - (lastOrder?.shopifyCreatedAt ?? now)) / (1000 * 60 * 60 * 24),
      );

      // Returning customers (2+ orders)
      if (lifetimeOrders >= 2) {
        returningCustomers++;
      }

      // VIP customers: High value (top 20% by value) OR frequent buyers (5+ orders and active)
      // For simplicity, we'll use: 5+ orders OR $2000+ lifetime value AND active in last 60 days
      if (
        (lifetimeOrders >= 5 || lifetimeValue >= 2000) &&
        daysSinceLastOrder <= 60
      ) {
        vipCustomers++;
      }

      // At Risk customers: Previously active but no purchase in 90+ days
      if (lifetimeOrders >= 2 && daysSinceLastOrder > 90) {
        atRiskCustomers++;
      }
    }

    return {
      totalCustomers,
      returningCustomers,
      vipCustomers,
      atRiskCustomers,
    };
  },
});

/**
 * Get geographic distribution
 */
export const getGeographicDistribution = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.object({
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
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth)
      return { countries: [], cities: [], heatmapData: [] };

    const organizationId = auth.orgId as Id<"organizations">;

    // Get customers with addresses
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Get orders scoped to the requested range (default: all time)
    let orders: Doc<"shopifyOrders">[];

    if (args.dateRange) {
      const startTime = new Date(args.dateRange.startDate).getTime();
      const endTime =
        new Date(args.dateRange.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

      orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", organizationId)
            .gte("shopifyCreatedAt", startTime)
            .lte("shopifyCreatedAt", endTime),
        )
        .collect();
    } else {
      orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();
    }

    if (orders.length === 0) {
      return { countries: [], cities: [], heatmapData: [] };
    }

    // Group orders by customer
    const customerOrdersMap = new Map<string, typeof orders>();

    for (const order of orders) {
      if (order.customerId) {
        if (!customerOrdersMap.has(order.customerId)) {
          customerOrdersMap.set(order.customerId, []);
        }
        customerOrdersMap.get(order.customerId)?.push(order);
      }
    }

    if (customerOrdersMap.size === 0) {
      return { countries: [], cities: [], heatmapData: [] };
    }

    // Group by country
    const countryMap = new Map<
      string,
      {
        country: string;
        customers: number;
        revenue: number;
        orders: number;
      }
    >();
    const cityMap = new Map<
      string,
      {
        city: string;
        country: string;
        customers: number;
        revenue: number;
      }
    >();
    const countryZipCodeMap = new Map<
      string,
      Map<
        string,
        {
          zipCode: string;
          city?: string;
          customers: number;
          revenue: number;
        }
      >
    >();

    customers.forEach((customer) => {
      const customerOrders = customerOrdersMap.get(customer._id);
      if (!customerOrders || customerOrders.length === 0) return;

      const country = customer.defaultAddress?.country || "Unknown";
      const city = customer.defaultAddress?.city || "Unknown";
      const zip = customer.defaultAddress?.zip?.trim();

      // Calculate metrics from orders within the selected window
      const periodRevenue = customerOrders.reduce(
        (sum, o) => sum + (o.totalPrice || 0),
        0,
      );
      const periodOrders = customerOrders.length;

      // Country aggregation
      if (!countryMap.has(country)) {
        countryMap.set(country, {
          country,
          customers: 0,
          revenue: 0,
          orders: 0,
        });
      }
      const countryData = countryMap.get(country);
      if (countryData) {
        countryData.customers++;
        countryData.revenue += periodRevenue;
        countryData.orders += periodOrders;
      }

      // City aggregation
      const cityKey = `${city}, ${country}`;

      if (!cityMap.has(cityKey)) {
        cityMap.set(cityKey, {
          city,
          country,
          customers: 0,
          revenue: 0,
        });
      }
      const cityData = cityMap.get(cityKey);
      if (cityData) {
        cityData.customers++;
        cityData.revenue += periodRevenue;
      }

      if (zip) {
        if (!countryZipCodeMap.has(country)) {
          countryZipCodeMap.set(country, new Map());
        }

        const countryZipMap = countryZipCodeMap.get(country);
        if (countryZipMap) {
          if (!countryZipMap.has(zip)) {
            countryZipMap.set(zip, {
              zipCode: zip,
              city: customer.defaultAddress?.city || undefined,
              customers: 0,
              revenue: 0,
            });
          }

          const zipData = countryZipMap.get(zip);
          if (zipData) {
            zipData.customers += 1;
            zipData.revenue += periodRevenue;

            if (!zipData.city && customer.defaultAddress?.city) {
              zipData.city = customer.defaultAddress.city;
            }
          }
        }
      }
    });

    // Convert to arrays and calculate averages
    const countries = Array.from(countryMap.values()).map((c) => {
      const zipCodes = Array.from(countryZipCodeMap.get(c.country)?.values() ?? [])
        .sort((a, b) => b.revenue - a.revenue);

      return {
        ...c,
        avgOrderValue: c.orders > 0 ? c.revenue / c.orders : 0,
        zipCodes,
      };
    });

    const cities = Array.from(cityMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 cities

    const heatmapData: Array<{ lat: number; lng: number; value: number }> = [];

    return {
      countries: countries.sort((a, b) => b.revenue - a.revenue),
      cities,
      heatmapData,
    };
  },
});

/**
 * Get customer journey funnel
 */
export const getCustomerJourney = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.array(
    v.object({
      stage: v.string(),
      customers: v.number(),
      percentage: v.number(),
      avgDays: v.number(),
      conversionRate: v.number(),
      icon: v.string(),
      color: v.string(),
    }),
  ),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    // Get all customers and orders to track journey stages
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Group orders by customer
    const customerOrdersMap = new Map<string, typeof orders>();

    for (const order of orders) {
      if (order.customerId) {
        if (!customerOrdersMap.has(order.customerId)) {
          customerOrdersMap.set(order.customerId, []);
        }
        customerOrdersMap.get(order.customerId)?.push(order);
      }
    }

    // Count customers at each stage based on their order history
    const customersWithOrders = customers.filter((c) =>
      customerOrdersMap.has(c._id),
    );
    const totalCustomers = customersWithOrders.length;

    // Calculate actual journey stages based on customer order history

    const repeatCustomers = customersWithOrders.filter((c) => {
      const orders = customerOrdersMap.get(c._id) || [];

      return orders.length > 1;
    }).length;

    const loyalCustomers = customersWithOrders.filter((c) => {
      const orders = customerOrdersMap.get(c._id) || [];

      return orders.length >= 5;
    }).length;

    // Calculate average days between stages
    const avgDaysToFirstPurchase = 7; // Default estimate
    const avgDaysBetweenPurchases =
      customersWithOrders.reduce((sum, c) => {
        const custOrders = customerOrdersMap.get(c._id) || [];

        if (custOrders.length < 2) return sum;

        const sortedOrders = [...custOrders].sort(
          (a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt,
        );
        const daysBetween =
          (sortedOrders[sortedOrders.length - 1]?.shopifyCreatedAt ?? 0 -
            (sortedOrders[0]?.shopifyCreatedAt ?? 0)) /
          (1000 * 60 * 60 * 24 * (custOrders.length - 1));

        return sum + daysBetween;
      }, 0) / Math.max(repeatCustomers, 1);

    // Estimate total visitors (typically 2-3% conversion rate)
    const estimatedVisitors = Math.round(totalCustomers / 0.025);
    const estimatedInterested = Math.round(totalCustomers / 0.04);

    const stages = [
      {
        stage: "Awareness",
        customers: estimatedVisitors,
        percentage: 100,
        avgDays: 0,
        conversionRate: Math.round(
          (estimatedInterested / estimatedVisitors) * 100,
        ),
        icon: "solar:eye-bold-duotone",
        color: "primary",
      },
      {
        stage: "Interest",
        customers: estimatedInterested,
        percentage: Math.round((estimatedInterested / estimatedVisitors) * 100),
        avgDays: 2,
        conversionRate: Math.round(
          (totalCustomers / estimatedInterested) * 100,
        ),
        icon: "solar:heart-bold-duotone",
        color: "secondary",
      },
      {
        stage: "Consideration",
        customers: Math.round(totalCustomers * 1.2), // Some consider but don't buy
        percentage: Math.round(
          ((totalCustomers * 1.2) / estimatedVisitors) * 100,
        ),
        avgDays: 5,
        conversionRate: Math.round(
          (totalCustomers / (totalCustomers * 1.2)) * 100,
        ),
        icon: "solar:cart-bold-duotone",
        color: "warning",
      },
      {
        stage: "Purchase",
        customers: totalCustomers,
        percentage: Math.round((totalCustomers / estimatedVisitors) * 100),
        avgDays: avgDaysToFirstPurchase,
        conversionRate: Math.round((repeatCustomers / totalCustomers) * 100),
        icon: "solar:bag-bold-duotone",
        color: "success",
      },
      {
        stage: "Retention",
        customers: repeatCustomers,
        percentage: Math.round((repeatCustomers / estimatedVisitors) * 100),
        avgDays: Math.round(avgDaysBetweenPurchases),
        conversionRate: Math.round(
          (loyalCustomers / Math.max(repeatCustomers, 1)) * 100,
        ),
        icon: "solar:refresh-circle-bold-duotone",
        color: "info",
      },
    ];

    // Recalculate percentages based on first stage
    const firstStageCustomers = stages[0]?.customers ?? 1;

    return stages.map((stage) => ({
      ...stage,
      customers: Math.round(stage.customers),
      percentage: Math.round((stage.customers / firstStageCustomers) * 100),
    }));
  },
});

export const getAnalytics = action({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
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

    const page = Math.max(1, Math.floor(args.page ?? 1));
    const pageSize = Math.min(
      Math.max(args.pageSize ?? 50, 1),
      MAX_CUSTOMER_PAGE_SIZE,
    );
    const searchTerm = args.searchTerm?.trim()
      ? args.searchTerm.trim()
      : undefined;
    const sortOrder = args.sortOrder ?? "desc";

    const [overview, cohorts, customerList, geographic, journey] =
      await Promise.all([
        ctx.runQuery(api.web.customers.getCustomerOverview, {
          dateRange: args.dateRange,
        }),
        ctx.runQuery(api.web.customers.getCohortAnalysis, {
          dateRange: args.dateRange,
          cohortType: "monthly",
        }),
        ctx.runQuery(api.web.customers.getCustomerList, {
          dateRange: args.dateRange,
          page,
          pageSize,
          searchTerm,
          segment: args.segment,
          sortBy: args.sortBy,
          sortOrder,
        }),
        ctx.runQuery(api.web.customers.getGeographicDistribution, {
          dateRange: args.dateRange,
        }),
        ctx.runQuery(api.web.customers.getCustomerJourney, {
          dateRange: args.dateRange,
        }),
      ]);

    const listEntries = (customerList?.data ?? customerList?.page ?? []) as CustomerListEntry[];
    const pagination = customerList?.pagination ?? {
      page,
      pageSize,
      total: listEntries.length,
      totalPages: Math.max(1, Math.ceil(Math.max(listEntries.length, 1) / pageSize)),
    };

    const customersData = customerList
      ? {
          data: listEntries,
          pagination,
          continueCursor: customerList.continueCursor,
        }
      : null;

    return {
      dateRange: args.dateRange,
      organizationId: auth.orgId,
      result: {
        overview: overview ?? null,
        cohorts: cohorts ?? [],
        customerList: customersData,
        geographic: geographic ?? null,
        journey: journey ?? [],
      },
    };
  },
});
