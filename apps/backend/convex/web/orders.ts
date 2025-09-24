import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";
import { percentageOfMoney, roundMoney } from "../../libs/utils/money";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const toDateTimestamp = (dateKey: string, endOfDay = false): number => {
  const base = new Date(`${dateKey}T00:00:00.000Z`).getTime();

  return endOfDay ? base + MS_IN_DAY - 1 : base;
};

const formatDateKey = (date: Date): string =>
  date.toISOString().substring(0, 10);

const roundPercentage = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

interface AggregatedOverviewMetrics {
  revenue: number;
  totalCosts: number;
  netProfit: number;
  taxesCollected: number;
  orders: number;
  grossProfit: number;
  grossSales: number;
  totalAdSpend: number;
  newCustomers: number;
  cacWeightedSum: number;
  cacWeight: number;
}

const aggregateDailyMetrics = (
  metrics: Array<Doc<"metricsDaily">>,
): AggregatedOverviewMetrics => {
  return metrics.reduce<AggregatedOverviewMetrics>(
    (acc, metric) => {
      acc.revenue += metric.revenue || 0;
      acc.totalCosts += metric.totalCosts || 0;
      acc.netProfit += metric.netProfit || 0;
      acc.taxesCollected += metric.taxesCollected || 0;
      acc.orders += metric.orders || 0;
      acc.grossProfit += metric.grossProfit || 0;
      acc.grossSales += metric.grossSales || 0;
      acc.totalAdSpend += metric.totalAdSpend || 0;
      acc.newCustomers += metric.newCustomers || 0;

      if (metric.newCustomers > 0) {
        acc.cacWeightedSum +=
          (metric.customerAcquisitionCost || 0) * metric.newCustomers;
        acc.cacWeight += metric.newCustomers;
      }

      return acc;
    },
    {
      revenue: 0,
      totalCosts: 0,
      netProfit: 0,
      taxesCollected: 0,
      orders: 0,
      grossProfit: 0,
      grossSales: 0,
      totalAdSpend: 0,
      newCustomers: 0,
      cacWeightedSum: 0,
      cacWeight: 0,
    },
  );
};

const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;

  return ((current - previous) / previous) * 100;
};

interface OrderCostSummary {
  totalCost: number;
  profit: number;
  profitMargin: number;
}

const selectVariantComponentForOrder = (
  components: Doc<"productCostComponents">[] | undefined,
  orderTimestamp: number,
): Doc<"productCostComponents"> | undefined => {
  if (!components || components.length === 0) return undefined;

  let selected: Doc<"productCostComponents"> | undefined;

  for (const component of components) {
    if (component.isActive === false) continue;
    if (
      typeof component.effectiveFrom === "number" &&
      component.effectiveFrom > orderTimestamp
    ) {
      continue;
    }
    if (
      typeof component.effectiveTo === "number" &&
      component.effectiveTo < orderTimestamp
    ) {
      continue;
    }

    if (
      !selected ||
      (typeof component.effectiveFrom === "number" &&
        (component.effectiveFrom || 0) > (selected.effectiveFrom || 0))
    ) {
      selected = component;
    }
  }

  if (selected) return selected;

  return components.find((component) => component.isActive !== false);
};

const isCostActiveForOrder = (
  cost: Doc<"costs">,
  orderTimestamp: number,
): boolean => {
  if (cost.isActive === false) return false;
  if (
    typeof cost.effectiveFrom === "number" &&
    cost.effectiveFrom > orderTimestamp
  ) {
    return false;
  }
  if (
    typeof cost.effectiveTo === "number" &&
    cost.effectiveTo < orderTimestamp
  ) {
    return false;
  }

  return true;
};

const computeOrderCost = (
  order: Doc<"shopifyOrders">,
  items: Array<Doc<"shopifyOrderItems">>,
  variantComponents: Map<string, Doc<"productCostComponents">[]>,
  costConfigs: Array<Doc<"costs">>,
): OrderCostSummary => {
  const orderTimestamp = order.shopifyCreatedAt || Date.now();
  const orderRevenue = order.totalPrice || 0;
  const grossSales = order.subtotalPrice || 0;
  const totalUnits = items.reduce((acc, item) => acc + (item.quantity || 0), 0);

  let cogs = 0;
  let shippingCost = 0;
  let handlingFees = 0;
  let transactionFees = 0;
  let marketingCosts = 0;
  let operationalCosts = 0;
  let taxCosts = 0;
  let otherCosts = 0;
  let revenueCoveredForCogs = 0;
  let revenueCoveredForPayment = 0;

  for (const item of items) {
    const qty = item.quantity || 0;
    const unitPrice = item.price || 0;
    const discount = item.totalDiscount || 0;
    const lineRevenue = Math.max(0, unitPrice * qty - discount);
    const variantId = item.variantId ? String(item.variantId) : undefined;
    const component = variantId
      ? selectVariantComponentForOrder(
          variantComponents.get(variantId),
          orderTimestamp,
        )
      : undefined;

    if (component) {
      if (typeof component.cogsPerUnit === "number" && component.cogsPerUnit > 0) {
        cogs += component.cogsPerUnit * qty;
        revenueCoveredForCogs += lineRevenue;
      }
      if (
        typeof component.shippingPerUnit === "number" &&
        component.shippingPerUnit > 0
      ) {
        shippingCost += component.shippingPerUnit * qty;
      }
      if (
        typeof component.handlingPerUnit === "number" &&
        component.handlingPerUnit > 0
      ) {
        handlingFees += component.handlingPerUnit * qty;
      }
      if (
        typeof component.paymentFeePercent === "number" &&
        component.paymentFeePercent > 0
      ) {
        transactionFees += percentageOfMoney(
          lineRevenue,
          component.paymentFeePercent,
        );
        revenueCoveredForPayment += lineRevenue;
      }
      if (
        typeof component.paymentFixedPerItem === "number" &&
        component.paymentFixedPerItem > 0
      ) {
        transactionFees += roundMoney(component.paymentFixedPerItem * qty);
      }
    }
  }

  for (const cost of costConfigs) {
    if (!isCostActiveForOrder(cost, orderTimestamp)) continue;

    const value = cost.value || 0;
    if (value === 0) continue;

    const config = (cost as { config?: any }).config ?? {};
    const frequency = cost.frequency || config.frequency;

    if (cost.calculation === "percentage") {
      if (cost.type === "product") {
        const base = Math.max(0, grossSales - revenueCoveredForCogs);
        if (base > 0) {
          cogs += percentageOfMoney(base, value);
        }
      } else if (cost.type === "payment") {
        const base = Math.max(0, orderRevenue - revenueCoveredForPayment);
        if (base > 0) {
          transactionFees += percentageOfMoney(base, value);
        }
        if (typeof config.fixedFee === "number" && config.fixedFee > 0) {
          transactionFees += roundMoney(config.fixedFee);
        }
      } else {
        const amount = percentageOfMoney(orderRevenue, value);

        switch (cost.type) {
          case "shipping":
            shippingCost += amount;
            break;
          case "handling":
            handlingFees += amount;
            break;
          case "marketing":
            marketingCosts += amount;
            break;
          case "operational":
            operationalCosts += amount;
            break;
          case "tax":
            taxCosts += amount;
            break;
          default:
            otherCosts += amount;
        }
      }
    } else if (cost.calculation === "fixed") {
      let amount = 0;

      switch (frequency) {
        case "per_item":
        case "per_unit":
          amount = roundMoney(value * totalUnits);
          break;
        case "per_order":
        case undefined:
          amount = roundMoney(value);
          break;
        default:
          amount = 0;
      }

      if (amount === 0) continue;

      switch (cost.type) {
        case "product":
          cogs += amount;
          break;
        case "shipping":
          shippingCost += amount;
          break;
        case "handling":
          handlingFees += amount;
          break;
        case "payment":
          transactionFees += amount;
          break;
        case "marketing":
          marketingCosts += amount;
          break;
        case "operational":
          operationalCosts += amount;
          break;
        case "tax":
          taxCosts += amount;
          break;
        default:
          otherCosts += amount;
      }
    } else if (cost.calculation === "per_unit") {
      const amount = roundMoney(value * totalUnits);
      if (amount === 0) continue;

      switch (cost.type) {
        case "product":
          cogs += amount;
          break;
        case "shipping":
          shippingCost += amount;
          break;
        case "handling":
          handlingFees += amount;
          break;
        case "payment":
          transactionFees += amount;
          break;
        case "marketing":
          marketingCosts += amount;
          break;
        case "operational":
          operationalCosts += amount;
          break;
        case "tax":
          taxCosts += amount;
          break;
        default:
          otherCosts += amount;
      }
    }
  }

  cogs = roundMoney(cogs);
  shippingCost = roundMoney(shippingCost);
  handlingFees = roundMoney(handlingFees);
  transactionFees = roundMoney(transactionFees);
  marketingCosts = roundMoney(marketingCosts);
  operationalCosts = roundMoney(operationalCosts);
  taxCosts = roundMoney(taxCosts);
  otherCosts = roundMoney(otherCosts);

  const totalCost = roundMoney(
    cogs +
      shippingCost +
      handlingFees +
      transactionFees +
      marketingCosts +
      operationalCosts +
      taxCosts +
      otherCosts,
  );

  const profit = roundMoney(orderRevenue - totalCost);
  const profitMargin =
    orderRevenue > 0 ? roundPercentage((profit / orderRevenue) * 100) : 0;

  return { totalCost, profit, profitMargin };
};

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

    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd);

    defaultStart.setDate(defaultStart.getDate() - 30);

    const effectiveDateRange = args.dateRange ?? {
      startDate: formatDateKey(defaultStart),
      endDate: formatDateKey(defaultEnd),
    };

    const startDateKey = effectiveDateRange.startDate;
    const endDateKey = effectiveDateRange.endDate;

    const rangeStartTs = toDateTimestamp(startDateKey);
    const rangeEndTs = toDateTimestamp(endDateKey, true);

    const periodDays = Math.max(
      1,
      Math.round((rangeEndTs - rangeStartTs) / MS_IN_DAY) + 1,
    );

    const previousEndTs = rangeStartTs - 1;
    const previousStartTs = previousEndTs - (periodDays - 1) * MS_IN_DAY;

    const previousStartKey = formatDateKey(new Date(previousStartTs));
    const previousEndKey = formatDateKey(new Date(previousEndTs));

    const [currentMetrics, previousMetrics, orders] = await Promise.all([
      ctx.db
        .query("metricsDaily")
        .withIndex("by_org_date", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("date", startDateKey)
            .lte("date", endDateKey),
        )
        .collect(),
      ctx.db
        .query("metricsDaily")
        .withIndex("by_org_date", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("date", previousStartKey)
            .lte("date", previousEndKey),
        )
        .collect(),
      ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("shopifyCreatedAt", previousStartTs)
            .lte("shopifyCreatedAt", rangeEndTs),
        )
        .collect(),
    ]);

    const currentOrders = orders.filter(
      (order) =>
        order.shopifyCreatedAt >= rangeStartTs &&
        order.shopifyCreatedAt <= rangeEndTs,
    );
    const previousOrders = orders.filter(
      (order) =>
        order.shopifyCreatedAt >= previousStartTs &&
        order.shopifyCreatedAt <= previousEndTs,
    );

    const totalOrders = currentOrders.length;
    const pendingOrders = currentOrders.filter(
      (o) =>
        o.fulfillmentStatus === "unfulfilled" &&
        o.financialStatus === "pending",
    ).length;
    const processingOrders = currentOrders.filter(
      (o) => o.fulfillmentStatus === "partial",
    ).length;
    const completedOrders = currentOrders.filter(
      (o) => o.fulfillmentStatus === "fulfilled",
    ).length;
    const cancelledOrders = currentOrders.filter(
      (o) => o.cancelledAt !== undefined && o.cancelledAt !== null,
    ).length;

    const aggregatedCurrent = aggregateDailyMetrics(currentMetrics);
    const aggregatedPrevious = aggregateDailyMetrics(previousMetrics);

    const totalRevenue = roundMoney(aggregatedCurrent.revenue);
    const totalCosts = roundMoney(aggregatedCurrent.totalCosts);
    const netProfit = roundMoney(aggregatedCurrent.netProfit);
    const totalTax = roundMoney(aggregatedCurrent.taxesCollected);

    const avgOrderValue =
      totalOrders > 0 ? roundMoney(totalRevenue / totalOrders) : 0;

    const fulfilledOrders = currentOrders.filter(
      (o) => o.fulfillmentStatus === "fulfilled",
    );
    const fulfillmentRate =
      totalOrders > 0
        ? roundPercentage((fulfilledOrders.length / totalOrders) * 100)
        : 0;

    const fulfillmentTimes = fulfilledOrders
      .map((o) => {
        if (typeof o.closedAt !== "number") return 0;

        return (o.closedAt - o.shopifyCreatedAt) / MS_IN_DAY;
      })
      .filter((t) => t > 0);
    const avgFulfillmentTime =
      fulfillmentTimes.length > 0
        ? roundPercentage(
            fulfillmentTimes.reduce((sum, t) => sum + t, 0) /
              fulfillmentTimes.length,
          )
        : 0;

    const returnedOrders = currentOrders.filter(
      (o) =>
        o.financialStatus === "refunded" ||
        o.financialStatus === "partially_refunded",
    ).length;
    const returnRate =
      totalOrders > 0
        ? roundPercentage((returnedOrders / totalOrders) * 100)
        : 0;

    const customerAcquisitionCost =
      aggregatedCurrent.cacWeight > 0
        ? roundMoney(
            aggregatedCurrent.cacWeightedSum / aggregatedCurrent.cacWeight,
          )
        : 0;

    const grossMargin =
      totalRevenue > 0
        ? roundPercentage((aggregatedCurrent.grossProfit / totalRevenue) * 100)
        : 0;

    const previousTotalOrders = previousOrders.length;
    const previousAvgOrderValue =
      previousTotalOrders > 0
        ? roundMoney(
            (aggregatedPrevious.revenue || 0) / previousTotalOrders,
          )
        : 0;

    const previousCustomerAcquisitionCost =
      aggregatedPrevious.cacWeight > 0
        ? roundMoney(
            aggregatedPrevious.cacWeightedSum / aggregatedPrevious.cacWeight,
          )
        : 0;

    const previousGrossMargin =
      aggregatedPrevious.revenue > 0
        ? roundPercentage(
            (aggregatedPrevious.grossProfit / aggregatedPrevious.revenue) * 100,
          )
        : 0;

    const previousFulfilledOrders = previousOrders.filter(
      (o) => o.fulfillmentStatus === "fulfilled",
    ).length;
    const previousFulfillmentRate =
      previousTotalOrders > 0
        ? roundPercentage(
            (previousFulfilledOrders / previousTotalOrders) * 100,
          )
        : 0;

    const changes = {
      totalOrders: roundPercentage(
        calculateChange(totalOrders, previousTotalOrders),
      ),
      revenue: roundPercentage(
        calculateChange(totalRevenue, roundMoney(aggregatedPrevious.revenue)),
      ),
      netProfit: roundPercentage(
        calculateChange(netProfit, roundMoney(aggregatedPrevious.netProfit)),
      ),
      avgOrderValue: roundPercentage(
        calculateChange(avgOrderValue, previousAvgOrderValue),
      ),
      cac: roundPercentage(
        calculateChange(
          customerAcquisitionCost,
          previousCustomerAcquisitionCost,
        ),
      ),
      margin: roundPercentage(
        calculateChange(grossMargin, previousGrossMargin),
      ),
      fulfillmentRate: roundPercentage(
        calculateChange(fulfillmentRate, previousFulfillmentRate),
      ),
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
 * Fallback: Sum order revenue by created-at range when analytics are unavailable.
 */
export const getRevenueSumForRange = query({
  args: {
    dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  },
  returns: v.object({
    totalRevenue: v.number(),
    totalOrders: v.number(),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return { totalRevenue: 0, totalOrders: 0 };

    const startTs = toDateTimestamp(args.dateRange.startDate);
    const endTs = toDateTimestamp(args.dateRange.endDate, true);

    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .gte("shopifyCreatedAt", startTs)
          .lte("shopifyCreatedAt", endTs),
      )
      .collect();

    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.totalPrice || 0),
      0,
    );

    return { totalRevenue: roundMoney(totalRevenue), totalOrders: orders.length };
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

    const [orders, customers, orderItems, productCostComponents, costConfigs] =
      await Promise.all([
        ctx.db
          .query("shopifyOrders")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", auth.orgId as Id<"organizations">),
          )
          .collect(),
        ctx.db
          .query("shopifyCustomers")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", auth.orgId as Id<"organizations">),
          )
          .collect(),
        ctx.db
          .query("shopifyOrderItems")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", auth.orgId as Id<"organizations">),
          )
          .collect(),
        ctx.db
          .query("productCostComponents")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", auth.orgId as Id<"organizations">),
          )
          .collect(),
        ctx.db
          .query("costs")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", auth.orgId as Id<"organizations">),
          )
          .collect(),
      ]);

    const orderItemsByOrder = new Map<string, Array<Doc<"shopifyOrderItems">>>();
    for (const item of orderItems) {
      const key = String(item.orderId);
      const list = orderItemsByOrder.get(key);
      if (list) {
        list.push(item);
      } else {
        orderItemsByOrder.set(key, [item]);
      }
    }

    const variantComponents = new Map<
      string,
      Array<Doc<"productCostComponents">>
    >();
    for (const component of productCostComponents) {
      const key = String(component.variantId);
      const list = variantComponents.get(key);
      if (list) {
        list.push(component);
      } else {
        variantComponents.set(key, [component]);
      }
    }

    const activeCosts = costConfigs.filter((cost) => cost.isActive !== false);
    const costSummaryByOrderId = new Map<string, OrderCostSummary>();

    for (const order of orders) {
      const items = orderItemsByOrder.get(String(order._id)) || [];
      const summary = computeOrderCost(
        order,
        items,
        variantComponents,
        activeCosts,
      );
      costSummaryByOrderId.set(String(order._id), summary);
    }

    // Map orders with customer data
    const ordersWithCustomers = orders.map((order) => {
      const customer = customers.find((c) => c._id === order.customerId);
      const summary =
        costSummaryByOrderId.get(String(order._id)) ?? (
          () => {
            const totalPrice = order.totalPrice || 0;

            return {
              totalCost: 0,
              profit: roundMoney(totalPrice),
              profitMargin: totalPrice > 0 ? 100 : 0,
            };
          }
        )();

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
        totalPrice: order.totalPrice || 0,
        totalCost: summary.totalCost,
        profit: summary.profit,
        profitMargin: summary.profitMargin,
        taxAmount: order.totalTax || 0,
        shippingCost: order.totalShippingPrice || 0,
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
      processingTimes.length > 0 ? avg(processingTimes) : 0;
    const avgShippingTime = shippingTimes.length > 0 ? avg(shippingTimes) : 0;
    const avgDeliveryTime = deliveryTimes.length > 0 ? avg(deliveryTimes) : 0;

    // Ensure logical consistency: processing <= shipping <= delivery
    const finalProcessingTime = avgProcessingTime;
    const finalShippingTime =
      avgShippingTime > 0
        ? Math.max(avgShippingTime, finalProcessingTime)
        : finalProcessingTime;
    const finalDeliveryTime =
      avgDeliveryTime > 0
        ? Math.max(avgDeliveryTime, finalShippingTime)
        : finalShippingTime;

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
