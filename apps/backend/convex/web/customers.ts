import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

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
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    // Get all customers and orders
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

      // Sort orders to find first order
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
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    data: v.array(
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
    pagination: v.object({
      page: v.number(),
      pageSize: v.number(),
      total: v.number(),
      totalPages: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth)
      return {
        data: [],
        pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      };

    const page = args.page || 1;
    const pageSize = args.pageSize || 50;

    // Get all customers
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Get all orders to calculate metrics
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

    // Merge customer data with calculated metrics
    const mergedData = customers.map((customer) => {
      const customerOrders = customerOrdersMap.get(customer._id) || [];

      // Calculate metrics from orders
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
      const firstOrder = sortedOrders[0];
      const lastOrder = sortedOrders[sortedOrders.length - 1]!;

      const metrics = {
        lifetimeValue,
        lifetimeOrders,
        avgOrderValue,
        firstOrderDate: firstOrder
          ? new Date(firstOrder.shopifyCreatedAt).toISOString().substring(0, 10)
          : "",
        lastOrderDate: lastOrder
          ? new Date(lastOrder.shopifyCreatedAt).toISOString().substring(0, 10)
          : "",
        segment: determineSegment(
          lifetimeOrders,
          lastOrder ? new Date(lastOrder.shopifyCreatedAt) : null,
        ),
      };

      // Determine status: converted if has orders, abandoned_cart if no orders
      const status = lifetimeOrders > 0 ? "converted" : "abandoned_cart";

      return {
        id: customer._id,
        name:
          `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
          "Unknown",
        email: customer.email || "",
        avatar: undefined,
        status,
        lifetimeValue: metrics.lifetimeValue,
        orders: metrics.lifetimeOrders,
        avgOrderValue: metrics.avgOrderValue,
        lastOrderDate: metrics.lastOrderDate,
        firstOrderDate: metrics.firstOrderDate,
        segment: metrics.segment,
        city: customer.defaultAddress?.city,
        country: customer.defaultAddress?.country,
      };
    });

    // Apply search filter
    let filteredData = mergedData;

    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();

      filteredData = filteredData.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term),
      );
    }

    // Apply segment filter
    if (args.segment) {
      filteredData = filteredData.filter((c) => c.segment === args.segment);
    }

    // Sort
    if (args.sortBy) {
      filteredData.sort((a, b) => {
        const aVal = a[args.sortBy as keyof typeof a];
        const bVal = b[args.sortBy as keyof typeof b];
        const order = args.sortOrder === "desc" ? -1 : 1;

        if (aVal === undefined || bVal === undefined) {
          return 0;
        }
        return aVal > bVal ? order : -order;
      });
    }

    // Paginate
    const total = filteredData.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedData = filteredData.slice(start, start + pageSize);

    return {
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  },
});

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
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth)
      return { countries: [], cities: [], heatmapData: [] };

    // Get customers with addresses
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Get all orders for revenue data
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

    customers.forEach((customer) => {
      const country = customer.defaultAddress?.country || "Unknown";
      const city = customer.defaultAddress?.city || "Unknown";
      const customerOrders = customerOrdersMap.get(customer._id) || [];

      // Calculate customer metrics from orders
      const lifetimeValue = customerOrders.reduce(
        (sum, o) => sum + (o.totalPrice || 0),
        0,
      );
      const lifetimeOrders = customerOrders.length;

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
        countryData.revenue += lifetimeValue;
        countryData.orders += lifetimeOrders;
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
        cityData.revenue += lifetimeValue;
      }
    });

    // Convert to arrays and calculate averages
    const countries = Array.from(countryMap.values()).map((c) => ({
      ...c,
      avgOrderValue: c.orders > 0 ? c.revenue / c.orders : 0,
    }));

    const cities = Array.from(cityMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 cities

    // Mock heatmap data (in production, would use geocoding)
    const heatmapData = [
      { lat: 40.7128, lng: -74.006, value: 100 }, // New York
      { lat: 34.0522, lng: -118.2437, value: 85 }, // Los Angeles
      { lat: 41.8781, lng: -87.6298, value: 70 }, // Chicago
    ];

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
