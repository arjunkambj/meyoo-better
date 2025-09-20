import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

/**
 * Orders Management API
 * Provides order data, fulfillment metrics, and status tracking
 */

/**
 * Get orders overview metrics
 */
export const getOrdersOverview = query({
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
      totalOrders: v.number(),
      pendingOrders: v.number(),
      processingOrders: v.number(),
      completedOrders: v.number(),
      cancelledOrders: v.number(),
      totalRevenue: v.number(),
      totalCosts: v.number(),
      netProfit: v.number(),
      totalTax: v.number(),
      avgOrderValue: v.number(),
      customerAcquisitionCost: v.number(),
      grossMargin: v.number(),
      fulfillmentRate: v.number(),
      avgFulfillmentTime: v.number(),
      returnRate: v.number(),
      changes: v.object({
        totalOrders: v.number(),
        revenue: v.number(),
        netProfit: v.number(),
        avgOrderValue: v.number(),
        cac: v.number(),
        margin: v.number(),
        fulfillmentRate: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Get ALL orders from shopifyOrders table for comparison purposes
    const allOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Use effective date range
    const effectiveDateRange = args.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10),
      endDate: new Date().toISOString().substring(0, 10),
    };

    // Filter orders for current period
    const orders = allOrders.filter((order) => {
      const orderDate = new Date(order.shopifyCreatedAt)
        .toISOString()
        .substring(0, 10);

      return (
        orderDate >= effectiveDateRange.startDate &&
        orderDate <= effectiveDateRange.endDate
      );
    });

    // Calculate metrics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(
      (o) =>
        o.fulfillmentStatus === "unfulfilled" &&
        o.financialStatus === "pending",
    ).length;
    const processingOrders = orders.filter(
      (o) => o.fulfillmentStatus === "partial",
    ).length;
    const completedOrders = orders.filter(
      (o) => o.fulfillmentStatus === "fulfilled",
    ).length;
    const cancelledOrders = orders.filter(
      (o) => o.cancelledAt !== undefined && o.cancelledAt !== null,
    ).length;

    const totalRevenue = orders.reduce(
      (sum, o) => sum + (o.totalPrice || 0),
      0,
    );
    const totalCosts = orders.reduce(
      (sum, o) => sum + (o.subtotalPrice || 0) * 0.6, // Assume 60% cost of subtotal
      0,
    );
    const totalTax = orders.reduce((sum, o) => sum + (o.totalTax || 0), 0);
    const totalShipping = orders.reduce(
      (sum, o) => sum + (o.totalShippingPrice || 0),
      0,
    );
    const netProfit = totalRevenue - totalCosts - totalTax - totalShipping;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const customerAcquisitionCost =
      totalOrders > 0 ? (totalRevenue * 0.15) / totalOrders : 0; // Assume 15% of revenue for CAC
    const grossMargin =
      totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;

    // Calculate fulfillment metrics
    const fulfilledOrders = orders.filter(
      (o) => o.fulfillmentStatus === "fulfilled",
    );
    const fulfillmentRate =
      totalOrders > 0 ? (fulfilledOrders.length / totalOrders) * 100 : 0;

    // Calculate average fulfillment time in days
    const fulfillmentTimes = fulfilledOrders
      .filter((o) => o.closedAt)
      .map((o) => {
        if (!o.closedAt) return 0;
        const created = new Date(o.shopifyCreatedAt).getTime();
        const fulfilled = new Date(o.closedAt).getTime();

        return (fulfilled - created) / (1000 * 60 * 60 * 24); // Convert to days
      })
      .filter((t) => t > 0);
    const avgFulfillmentTime =
      fulfillmentTimes.length > 0
        ? fulfillmentTimes.reduce((sum, t) => sum + t, 0) /
          fulfillmentTimes.length
        : 0;

    // Calculate return rate (using financial status)
    const returnedOrders = orders.filter(
      (o) =>
        o.financialStatus === "refunded" ||
        o.financialStatus === "partially_refunded",
    ).length;
    const returnRate =
      totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;

    // Calculate changes from previous period
    const startStr = effectiveDateRange.startDate || new Date().toISOString().substring(0,10);
    const endStr = effectiveDateRange.endDate || new Date().toISOString().substring(0,10);
    const currentStart = new Date(startStr);
    const currentEnd = new Date(endStr);
    const periodLength = Math.ceil(
      (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const previousEndDate = new Date(startStr);

    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousStartDate = new Date(previousEndDate);

    previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

    const previousOrders = allOrders.filter((order) => {
      const orderDate = new Date(order.shopifyCreatedAt)
        .toISOString()
        .substring(0, 10);

      return (
        orderDate >= previousStartDate.toISOString().substring(0, 10) &&
        orderDate <= previousEndDate.toISOString().substring(0, 10)
      );
    });

    const prevTotalOrders = previousOrders.length;
    const prevTotalRevenue = previousOrders.reduce(
      (sum, o) => sum + (o.totalPrice || 0),
      0,
    );
    const prevTotalCosts = previousOrders.reduce(
      (sum, o) => sum + (o.subtotalPrice || 0) * 0.6,
      0,
    );
    const prevTotalTax = previousOrders.reduce(
      (sum, o) => sum + (o.totalTax || 0),
      0,
    );
    const prevTotalShipping = previousOrders.reduce(
      (sum, o) => sum + (o.totalShippingPrice || 0),
      0,
    );
    const prevNetProfit =
      prevTotalRevenue - prevTotalCosts - prevTotalTax - prevTotalShipping;
    const prevAvgOrderValue =
      prevTotalOrders > 0 ? prevTotalRevenue / prevTotalOrders : 0;
    const prevCAC =
      prevTotalOrders > 0 ? (prevTotalRevenue * 0.15) / prevTotalOrders : 0;
    const prevGrossMargin =
      prevTotalRevenue > 0
        ? ((prevTotalRevenue - prevTotalCosts) / prevTotalRevenue) * 100
        : 0;
    const prevFulfilledOrders = previousOrders.filter(
      (o) => o.fulfillmentStatus === "fulfilled",
    );
    const prevFulfillmentRate =
      prevTotalOrders > 0
        ? (prevFulfilledOrders.length / prevTotalOrders) * 100
        : 0;

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;

      return ((current - previous) / previous) * 100;
    };

    const changes = {
      totalOrders: calculateChange(totalOrders, prevTotalOrders),
      revenue: calculateChange(totalRevenue, prevTotalRevenue),
      netProfit: calculateChange(netProfit, prevNetProfit),
      avgOrderValue: calculateChange(avgOrderValue, prevAvgOrderValue),
      cac: calculateChange(customerAcquisitionCost, prevCAC),
      margin: calculateChange(grossMargin, prevGrossMargin),
      fulfillmentRate: calculateChange(fulfillmentRate, prevFulfillmentRate),
    };

    return {
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      totalCosts,
      netProfit,
      totalTax,
      avgOrderValue,
      customerAcquisitionCost,
      grossMargin,
      fulfillmentRate,
      avgFulfillmentTime,
      returnRate,
      changes,
    };
  },
});

/**
 * Get paginated orders list
 */
export const getOrdersList = query({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    status: v.optional(v.union(v.string(), v.null())),
    searchTerm: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.object({
    data: v.array(
      v.object({
        id: v.string(),
        orderNumber: v.string(),
        customer: v.object({
          name: v.string(),
          email: v.string(),
          avatar: v.optional(v.string()),
        }),
        status: v.string(),
        fulfillmentStatus: v.string(),
        financialStatus: v.string(),
        items: v.number(),
        totalPrice: v.number(),
        totalCost: v.number(),
        profit: v.number(),
        profitMargin: v.number(),
        taxAmount: v.number(),
        shippingCost: v.number(),
        paymentMethod: v.string(),
        tags: v.optional(v.array(v.string())),
        shippingAddress: v.object({
          city: v.string(),
          country: v.string(),
        }),
        createdAt: v.string(),
        updatedAt: v.string(),
        lineItems: v.optional(
          v.array(
            v.object({
              id: v.string(),
              name: v.string(),
              quantity: v.number(),
              price: v.number(),
              cost: v.number(),
            }),
          ),
        ),
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

    // Get orders
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Get customers for order data
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Map orders with customer data
    const ordersWithCustomers = orders.map((order) => {
      const customer = customers.find((c) => c._id === order.customerId);

      // Calculate financial metrics
      const totalPrice = order.totalPrice || 0;
      const totalCost = (order.subtotalPrice || 0) * 0.6; // Assume 60% cost of subtotal
      const taxAmount = order.totalTax || 0;
      const shippingCost = order.totalShippingPrice || 0;
      const profit = totalPrice - totalCost - taxAmount - shippingCost;
      const profitMargin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;

      // Determine payment method based on financial status
      let paymentMethod = "Credit Card";

      if (
        order.financialStatus === "pending" &&
        order.fulfillmentStatus !== "cancelled"
      ) {
        paymentMethod = "COD"; // Cash on Delivery for pending payments
      } else if (order.financialStatus === "paid") {
        paymentMethod = "Paid"; // Already paid via credit card or other method
      }

      // Process line items (will be fetched separately if needed)
      const lineItems = undefined; // Line items are in a separate table

      return {
        id: order._id,
        orderNumber: order.orderNumber || order.shopifyId || "N/A",
        customer: {
          name: customer
            ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
              "Unknown"
            : "Guest",
          email: customer?.email || order.email || "No email",
          avatar: undefined,
        },
        status: order.fulfillmentStatus || "unfulfilled",
        fulfillmentStatus: order.fulfillmentStatus || "unfulfilled",
        financialStatus: order.financialStatus || "pending",
        items: order.totalQuantity || 0,
        totalPrice,
        totalCost,
        profit,
        profitMargin,
        taxAmount,
        shippingCost,
        paymentMethod,
        tags: order.tags || undefined,
        shippingAddress: {
          city: order.shippingAddress?.city || "Unknown",
          country: order.shippingAddress?.country || "Unknown",
        },
        createdAt: new Date(order.shopifyCreatedAt).toISOString(),
        updatedAt: new Date(
          order.updatedAt || order.shopifyCreatedAt,
        ).toISOString(),
        lineItems,
      };
    });

    // Apply filters
    let filteredOrders = ordersWithCustomers;

    // Filter by date range
    if (args.dateRange?.startDate && args.dateRange.endDate) {
      const { startDate, endDate } = args.dateRange;
      filteredOrders = filteredOrders.filter((order) => {
        const created = order.createdAt.substring(0, 10);
        return created >= startDate && created <= endDate;
      });
    }

    // Filter by fulfillment status
    if (args.status) {
      filteredOrders = filteredOrders.filter(
        (order) => order.fulfillmentStatus === args.status,
      );
    }

    // Search filter
    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();

      filteredOrders = filteredOrders.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(term) ||
          order.customer.name.toLowerCase().includes(term) ||
          order.customer.email.toLowerCase().includes(term),
      );
    }

    // Sort
    if (args.sortBy) {
      filteredOrders.sort((a, b) => {
        const aVal = a[args.sortBy as keyof typeof a];
        const bVal = b[args.sortBy as keyof typeof b];
        const order = args.sortOrder === "desc" ? -1 : 1;

        if (aVal === undefined || bVal === undefined) {
          return 0;
        }
        return aVal > bVal ? order : -order;
      });
    } else {
      // Default sort by created date desc
      filteredOrders.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    // Paginate
    const total = filteredOrders.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedData = filteredOrders.slice(start, start + pageSize);

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

/**
 * Get order status distribution
 */
export const getStatusDistribution = query({
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
      status: v.string(),
      count: v.number(),
      percentage: v.number(),
      color: v.string(),
      icon: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    // Get orders
    let orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Filter by date range if provided
    if (args.dateRange?.startDate && args.dateRange.endDate) {
      const { startDate, endDate } = args.dateRange;
      orders = orders.filter((order) => {
        const orderDate = new Date(order.shopifyCreatedAt)
          .toISOString()
          .substring(0, 10);

        return orderDate >= startDate && orderDate <= endDate;
      });
    }

    // Count by status
    const statusCounts = new Map<string, number>();

    orders.forEach((order) => {
      const status = order.financialStatus || "pending";

      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });

    const totalOrders = orders.length;

    // Define status metadata
    const statusMeta = {
      pending: {
        color: "warning",
        icon: "solar:clock-circle-bold-duotone",
      },
      processing: {
        color: "primary",
        icon: "solar:refresh-circle-bold-duotone",
      },
      shipped: {
        color: "secondary",
        icon: "solar:delivery-bold-duotone",
      },
      delivered: {
        color: "success",
        icon: "solar:check-circle-bold-duotone",
      },
      cancelled: {
        color: "danger",
        icon: "solar:close-circle-bold-duotone",
      },
      refunded: {
        color: "default",
        icon: "solar:card-recive-bold-duotone",
      },
    };

    const distribution = Array.from(statusCounts.entries()).map(
      ([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
        color:
          statusMeta[status as keyof typeof statusMeta]?.color || "default",
        icon:
          statusMeta[status as keyof typeof statusMeta]?.icon ||
          "solar:box-bold-duotone",
      }),
    );

    return distribution;
  },
});

/**
 * Get fulfillment metrics
 */
export const getFulfillmentMetrics = query({
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
      avgProcessingTime: v.number(),
      avgShippingTime: v.number(),
      avgDeliveryTime: v.number(),
      onTimeDeliveryRate: v.number(),
      ordersInTransit: v.number(),
      ordersDeliveredToday: v.number(),
      pendingFulfillments: v.number(),
      fulfillmentAccuracy: v.number(),
      returnRate: v.number(),
      avgFulfillmentCost: v.number(),
      totalOrders: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Get orders
    let orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Filter by date range if provided
    if (args.dateRange?.startDate && args.dateRange.endDate) {
      const { startDate, endDate } = args.dateRange;
      orders = orders.filter((order) => {
        const orderDate = new Date(order.shopifyCreatedAt)
          .toISOString()
          .substring(0, 10);

        return orderDate >= startDate && orderDate <= endDate;
      });
    }

    // Return null if no orders found
    if (orders.length === 0) {
      return null;
    }

    // Calculate processing times
    const processingTimes: number[] = [];
    const shippingTimes: number[] = [];
    const deliveryTimes: number[] = [];

    orders.forEach((order) => {
      const created = new Date(order.shopifyCreatedAt).getTime();

      // Processing time (created to when order starts fulfillment)
      if (order.fulfillmentStatus !== "unfulfilled") {
        const processed = order.processedAt
          ? new Date(order.processedAt).getTime()
          : order.updatedAt
            ? new Date(order.updatedAt).getTime()
            : created + 24 * 60 * 60 * 1000; // Default 1 day if no data

        processingTimes.push((processed - created) / (1000 * 60 * 60 * 24));
      }

      // Shipping time (cumulative: created to shipped)
      if (
        order.fulfillmentStatus === "partial" ||
        order.fulfillmentStatus === "fulfilled"
      ) {
        const shipped = order.updatedAt
          ? new Date(order.updatedAt).getTime()
          : created + 3 * 24 * 60 * 60 * 1000; // Default 3 days total for shipping

        shippingTimes.push((shipped - created) / (1000 * 60 * 60 * 24));
      }

      // Delivery time (cumulative: created to delivered)
      if (order.fulfillmentStatus === "fulfilled") {
        const delivered = order.closedAt
          ? new Date(order.closedAt).getTime()
          : created + 5 * 24 * 60 * 60 * 1000; // Default 5 days total for delivery

        deliveryTimes.push((delivered - created) / (1000 * 60 * 60 * 24));
      }
    });

    const avg = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sum = arr.reduce((a, b) => a + b, 0);

      return Math.max(0, sum / arr.length); // Ensure non-negative
    };

    // Count current statuses
    const today = new Date().toISOString().split("T")[0];
    const ordersInTransit = orders.filter(
      (o) => o.fulfillmentStatus === "partial",
    ).length;
    const ordersDeliveredToday = orders.filter(
      (o) =>
        o.fulfillmentStatus === "fulfilled" &&
        o.closedAt &&
        new Date(o.closedAt).toISOString().split("T")[0] === today,
    ).length;
    const pendingFulfillments = orders.filter(
      (o) => o.fulfillmentStatus === "unfulfilled",
    ).length;

    // Calculate rates
    const onTimeOrders = orders.filter((o) => {
      if (!o.closedAt) return false;
      const fulfilled = new Date(o.closedAt).getTime();
      const created = new Date(o.shopifyCreatedAt).getTime();
      const days = (fulfilled - created) / (1000 * 60 * 60 * 24);

      return days <= 5; // Consider on-time if delivered within 5 days
    }).length;
    const onTimeDeliveryRate =
      orders.length > 0 ? (onTimeOrders / orders.length) * 100 : 0;

    // Calculate fulfillment accuracy based on successful fulfillments
    const totalFulfillments = orders.filter(
      (o) => o.fulfillmentStatus !== "unfulfilled",
    ).length;
    const successfulFulfillments = orders.filter(
      (o) => o.fulfillmentStatus === "fulfilled" && !o.cancelledAt,
    ).length;
    const fulfillmentAccuracy =
      totalFulfillments > 0
        ? Math.min(100, (successfulFulfillments / totalFulfillments) * 100)
        : 0;

    // Calculate return rate
    const returnedOrders = orders.filter(
      (o) =>
        o.financialStatus === "refunded" ||
        o.financialStatus === "partially_refunded",
    ).length;
    const returnRate =
      orders.length > 0 ? (returnedOrders / orders.length) * 100 : 0;

    // Calculate averages with proper defaults only if we have some data
    const avgProcessingTime =
      processingTimes.length > 0 ? avg(processingTimes) : 1.0;
    const avgShippingTime = shippingTimes.length > 0 ? avg(shippingTimes) : 3.0;
    const avgDeliveryTime = deliveryTimes.length > 0 ? avg(deliveryTimes) : 5.0;

    // Ensure logical consistency: processing <= shipping <= delivery
    const finalProcessingTime = avgProcessingTime;
    const finalShippingTime = Math.max(
      avgShippingTime,
      avgProcessingTime + 1.0,
    );
    const finalDeliveryTime = Math.max(
      avgDeliveryTime,
      finalShippingTime + 1.0,
    );

    // Calculate average fulfillment cost (shipping cost per order)
    const totalShippingCost = orders.reduce(
      (sum, o) => sum + (o.totalShippingPrice || 0),
      0,
    );
    const avgFulfillmentCost =
      orders.length > 0 ? totalShippingCost / orders.length : 0;

    return {
      avgProcessingTime: finalProcessingTime,
      avgShippingTime: finalShippingTime,
      avgDeliveryTime: finalDeliveryTime,
      onTimeDeliveryRate: Math.min(100, Math.max(0, onTimeDeliveryRate)),
      ordersInTransit,
      ordersDeliveredToday,
      pendingFulfillments,
      fulfillmentAccuracy: Math.min(100, Math.max(0, fulfillmentAccuracy)),
      returnRate: Math.min(100, Math.max(0, returnRate)),
      avgFulfillmentCost,
      totalOrders: orders.length,
    };
  },
});

/**
 * Get order timeline events
 */
export const getOrderTimeline = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      type: v.string(),
      title: v.string(),
      description: v.string(),
      timestamp: v.string(),
      customer: v.optional(
        v.object({
          name: v.string(),
          avatar: v.optional(v.string()),
        }),
      ),
      orderNumber: v.optional(v.string()),
      amount: v.optional(v.number()),
      icon: v.string(),
      color: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    // Get recent orders
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .order("desc")
      .take(args.limit || 10);

    // Get customers
    const customerIds = orders
      .map((o) => o.customerId)
      .filter(Boolean) as string[];
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect()
      .then((allCustomers) =>
        allCustomers.filter((c) => customerIds.includes(c._id)),
      );

    // Create timeline events
    const events = orders.map((order) => {
      const customer = customers.find((c) => c._id === order.customerId);
      const customerName = customer
        ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
          "Unknown"
        : "Guest";

      // Determine event type and styling
      let type = "order_created";
      let title = "New Order Received";
      let icon = "solar:bag-3-bold-duotone";
      let color = "primary";

      if (order.cancelledAt) {
        type = "order_cancelled";
        title = "Order Cancelled";
        icon = "solar:close-circle-bold-duotone";
        color = "danger";
      } else if (order.fulfillmentStatus === "fulfilled") {
        type = "order_delivered";
        title = "Order Delivered";
        icon = "solar:check-circle-bold-duotone";
        color = "success";
      } else if (order.fulfillmentStatus === "partial") {
        type = "order_shipped";
        title = "Order Shipped";
        icon = "solar:delivery-bold-duotone";
        color = "secondary";
      } else if (order.financialStatus === "paid") {
        type = "payment_received";
        title = "Payment Confirmed";
        icon = "solar:card-tick-bold-duotone";
        color = "success";
      }

      // Calculate time ago
      const now = Date.now();
      const created = new Date(order.shopifyCreatedAt).getTime();
      const diff = now - created;
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      let timestamp = "just now";

      if (days > 0) {
        timestamp = `${days} day${days > 1 ? "s" : ""} ago`;
      } else if (hours > 0) {
        timestamp = `${hours} hour${hours > 1 ? "s" : ""} ago`;
      } else if (minutes > 0) {
        timestamp = `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
      }

      return {
        id: order._id,
        type,
        title,
        description: `Order #${order.orderNumber || order.shopifyId} ${
          type === "order_cancelled" ? "cancelled by" : "from"
        } ${customerName}`,
        timestamp,
        customer: {
          name: customerName,
          avatar: undefined,
        },
        orderNumber: order.orderNumber || order.shopifyId,
        amount: order.totalPrice,
        icon,
        color,
      };
    });

    return events;
  },
});
