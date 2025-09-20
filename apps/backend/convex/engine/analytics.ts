import { v } from "convex/values";
import { percentageOfMoney, roundMoney } from "../../libs/utils/money";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
/**
 * Main analytics calculation engine (for workpool onComplete callbacks)
 * Handles all metric calculations and aggregations
 */
export const calculate = internalMutation({
  args: {
    workId: v.string(),
    result: v.any(),
    context: v.object({
      organizationId: v.id("organizations"),
      platform: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    const { organizationId } = _args.context;

    // production: avoid noisy analytics logs

    // Only proceed if the sync was successful
    if (_args.result?.kind !== "success") {
      // production: skip log when not successful

      return;
    }

    try {
      // Trigger the actual analytics calculation action
      await _ctx.scheduler.runAfter(
        0,
        internal.engine.analytics.calculateAnalytics,
        {
          organizationId,
          dateRange: { daysBack: 60 },
        },
      );

      // production: avoid noisy analytics logs
    } catch (error) {
      console.error(
        `[ANALYTICS] Failed to schedule analytics calculation for organization ${organizationId}:`,
        error,
      );
    }
  },
});

/**
 * Main analytics calculation action (actual calculation logic)
 * Handles all metric calculations and aggregations
 */
export const calculateAnalytics = internalAction({
  args: {
    organizationId: v.string(),
    // Optional flags passed by workpool jobs/schedulers
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
    metricsCalculated: v.number(),
    duration: v.number(),
  }),
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // Determine date range
    const dateRange = getDateRange(args.dateRange);

    // Get all data needed for calculations
    const data = await ctx.runQuery(
      internal.engine.analytics.gatherAnalyticsData,
      {
        organizationId: args.organizationId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    );

    // Calculate daily metrics
    const dailyMetrics = calculateDailyMetrics(data);

    // production: avoid noisy analytics logs

    // Store metrics
    let metricsCalculated = 0;

    for (const metric of dailyMetrics) {
      await ctx.runMutation(internal.engine.analytics.storeMetric, {
        organizationId: metric.organizationId,
        date: metric.date,
        metrics: metric,
      });
      metricsCalculated++;
    }

    // Calculate aggregations (weekly/monthly)
    await ctx.runMutation(internal.engine.analytics.calculateAggregations, {
      organizationId: args.organizationId,
      dateRange,
    });

    // Update realtime metrics
    await ctx.runMutation(internal.engine.analytics.updateRealtimeMetrics, {
      organizationId: args.organizationId,
    });

    return {
      success: true,
      metricsCalculated,
      duration: Date.now() - startTime,
    };
  },
});

/**
 * Lightweight incremental updates for realtime metrics after webhooks
 * These wrappers are invoked by the events engine.
 */
export const updateOrderMetrics = internalAction({
  args: {
    organizationId: v.string(),
    orderId: v.optional(v.string()),
    eventType: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const _today = new Date().toISOString().substring(0, 10);
    await ctx.runMutation(internal.engine.analytics.updateRealtimeMetrics, {
      organizationId: args.organizationId,
    });

    return { success: true };
  },
});

export const updateCustomerMetrics = internalAction({
  args: {
    organizationId: v.string(),
    customerId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // For now reuse daily metrics to keep realtime counters fresh
    const _today = new Date().toISOString().substring(0, 10);
    await ctx.runMutation(internal.engine.analytics.updateRealtimeMetrics, {
      organizationId: args.organizationId,
    });
    return { success: true };
  },
});

export const updateProductMetrics = internalAction({
  args: {
    organizationId: v.string(),
    productId: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (_ctx, _args) => {
    // Delegate to product metrics calculator; it stores results itself
    // Placeholder: no separate product calc action defined currently
    return { success: true };
  },
});

export const recalculateAllMetrics = internalAction({
  args: {
    organizationId: v.string(),
    dateRange: v.optional(
      v.object({ startDate: v.string(), endDate: v.string() }),
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.runAction(internal.engine.analytics.calculateAnalytics, {
      organizationId: args.organizationId,
      dateRange: args.dateRange,
    });
    return { success: true };
  },
});

/**
 * Gather all data needed for analytics calculations
 */
export const gatherAnalyticsData = internalQuery({
  args: {
    organizationId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: v.object({
    shopifyOrders: v.array(v.any()),
    shopifyProducts: v.array(v.any()),
    shopifyVariants: v.array(v.any()),
    orderItems: v.array(v.any()),
    productCostComponents: v.array(v.any()),
    metaInsights: v.array(v.any()),
    costs: v.array(v.any()),
    startDate: v.string(),
    endDate: v.string(),
    organizationId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get Shopify data
    const shopifyOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    const shopifyProducts = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    const shopifyVariants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    const orderItems = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    const productCostComponents = await ctx.db
      .query("productCostComponents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    // Get Meta insights
    const metaInsights = await ctx.db
      .query("metaInsights")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    // Get costs
    const costs = await ctx.db
      .query("costs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    // production: avoid noisy analytics logs

    return {
      shopifyOrders,
      shopifyProducts,
      shopifyVariants,
      orderItems,
      productCostComponents,
      metaInsights,
      costs,
      startDate: args.startDate,
      endDate: args.endDate,
      organizationId: args.organizationId,
    };
  },
});

/**
 * Calculate daily metrics from raw data
 */
type DailyMetric = {
  organizationId: string;
  date: string;
  revenue: number;
  orders: number;
  unitsSold: number;
  shippingCosts: number;
  taxesPaid: number;
  discounts: number;
  refunds: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  metaAdSpend: number;
  metaImpressions: number;
  metaClicks: number;
  metaConversions: number;
  metaConversionValue: number;
  metaCTR: number;
  metaCPC: number;
  metaCPM: number;
  metaReach: number;
  metaFrequency: number;
  metaUniqueClicks: number;
  metaCostPerConversion: number;
  metaAddToCart: number;
  metaInitiateCheckout: number;
  metaPageViews: number;
  metaViewContent: number;
  metaLinkClicks: number;
  metaOutboundClicks: number;
  metaLandingPageViews: number;
  metaVideoViews: number;
  metaVideo3SecViews: number;
  metaVideoThruPlay: number;
  metaCostPerThruPlay: number;
  googleAdSpend: number;
  totalAdSpend: number;
  grossSales: number;
  handlingFees: number;
  customCosts: number;
  transactionFees: number;
  shippingCharged: number;
  taxesCollected: number;
  blendedRoas: number;
  metaROAS: number;
  googleROAS: number;
  avgOrderValue: number;
  avgOrderCost: number;
  avgOrderProfit: number;
  adSpendPerOrder: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatCustomerRate: number;
  contributionMargin: number;
  contributionMarginPercentage: number;
  totalCosts: number;
  grossProfitMargin: number;
  netProfitMargin: number;
  discountRate: number;
  returns: number;
  customerAcquisitionCost: number;
  uniqueCustomers: Set<string>;
  updatedAt: string;
};

type AnalyticsData = {
  shopifyOrders: Array<{
    shopifyCreatedAt?: number | string;
    createdAt?: number;
    totalPrice?: number;
    subtotalPrice?: number;
    totalDiscounts?: number;
    totalShippingPrice?: number;
    totalTax?: number;
    totalTip?: number;
    totalQuantity?: number;
    customerId?: string;
  }>;
  shopifyProducts: unknown[];
  shopifyVariants: Array<{
    _id?: string;
    costPerItem?: number;
  }>;
  orderItems: Array<{
    orderId: string;
    variantId?: string;
    quantity: number;
    price: number;
    totalDiscount: number;
  }>;
  productCostComponents: Array<{
    variantId: string;
    cogsPerUnit?: number;
    shippingPerUnit?: number;
    handlingPerUnit?: number;
    paymentFeePercent?: number;
    paymentFixedPerItem?: number;
    isActive?: boolean;
    effectiveFrom?: number;
    effectiveTo?: number;
  }>;
  metaInsights: Array<{
    date: string;
    spend?: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    conversionValue?: number;
    ctr?: number;
    cpc?: number;
    cpm?: number;
    roas?: number;
    reach?: number;
    frequency?: number;
    uniqueClicks?: number;
    costPerConversion?: number;
    addToCart?: number;
    initiateCheckout?: number;
    pageViews?: number;
    viewContent?: number;
    completeRegistration?: number;
    leads?: number;
    leadValue?: number;
    linkClicks?: number;
    outboundClicks?: number;
    landingPageViews?: number;
    videoViews?: number;
    video3SecViews?: number;
    videoThruPlay?: number;
    costPerThruPlay?: number;
  }>;
  costs: any[];
  startDate: string;
  endDate: string;
  organizationId: string;
};

function calculateDailyMetrics(data: AnalyticsData): DailyMetric[] {
  const metricsByDate: Record<string, DailyMetric> = {};
  // Precompute mappings for line-level cost allocation
  const itemsByOrder: Record<string, typeof data.orderItems> = {};
  for (const item of data.orderItems || []) {
    const key = String(item.orderId);
    (itemsByOrder[key] ||= []).push(item);
  }
  const componentsByVariant = new Map<string, any>();
  for (const c of (data.productCostComponents || [])) {
    if (!c || (c as any).isActive === false) continue;
    componentsByVariant.set(String((c as any).variantId), c);
  }
  // NOTE: Do not read legacy variant.costPerItem; rely on productCostComponents + org-level costs
  // Per-day accumulators to avoid double counting with percentage defaults
  const perVariantCogsByDate: Record<string, number> = {};
  const perVariantRevenueCoveredForCogs: Record<string, number> = {};
  const perVariantShippingByDate: Record<string, number> = {};
  const perVariantHandlingByDate: Record<string, number> = {};
  const perVariantPaymentByDate: Record<string, number> = {};
  const perVariantPaymentRevenueCovered: Record<string, number> = {};

  // Process Shopify orders
  for (const order of data.shopifyOrders) {
    // Use shopifyCreatedAt which is the actual field name
    const date = new Date(
      order.shopifyCreatedAt || order.createdAt || Date.now(),
    )
      .toISOString()
      .substring(0, 10);

    if (!metricsByDate[date]) {
      metricsByDate[date] = initializeMetrics(date, data.organizationId);
    }

    const metrics = metricsByDate[date];

    // Revenue metrics
    metrics.revenue += roundMoney(order.totalPrice || 0);
    metrics.grossSales += roundMoney(order.subtotalPrice || 0);
    metrics.discounts += roundMoney(order.totalDiscounts || 0);
    metrics.shippingCharged += roundMoney(order.totalShippingPrice || 0);
    metrics.taxesCollected += roundMoney(order.totalTax || 0);
    // Removed tips collection per request

    // Order metrics
    metrics.orders++;
    metrics.unitsSold += order.totalQuantity || 0; // Use totalQuantity instead of lineItems.length

    // Line-level product cost components
    const orderItems = itemsByOrder[String((order as any)._id)] || [];
    for (const li of orderItems) {
      const qty = li.quantity || 0;
      const unitPrice = li.price || 0;
      const discount = li.totalDiscount || 0;
      const lineRevenue = Math.max(0, unitPrice * qty - discount);
      const varId = li.variantId ? String(li.variantId) : undefined;
      const comp = varId ? componentsByVariant.get(varId) : undefined;

      // COGS per unit from product cost components only (no legacy fallbacks)
      const cogsPerUnit = (comp && typeof comp.cogsPerUnit === 'number')
        ? comp.cogsPerUnit
        : undefined;
      if (typeof cogsPerUnit === 'number' && cogsPerUnit > 0) {
        const add = roundMoney(cogsPerUnit * qty);
        perVariantCogsByDate[date] = (perVariantCogsByDate[date] || 0) + add;
        perVariantRevenueCoveredForCogs[date] = (perVariantRevenueCoveredForCogs[date] || 0) + lineRevenue;
      }

      // Shipping per unit override
      if (comp && typeof comp.shippingPerUnit === 'number' && comp.shippingPerUnit > 0) {
        perVariantShippingByDate[date] = (perVariantShippingByDate[date] || 0) + roundMoney(comp.shippingPerUnit * qty);
      }

      // Handling per unit override
      if (comp && typeof comp.handlingPerUnit === 'number' && comp.handlingPerUnit > 0) {
        perVariantHandlingByDate[date] = (perVariantHandlingByDate[date] || 0) + roundMoney(comp.handlingPerUnit * qty);
      }

      // Payment fee overrides (percent on revenue + fixed per item)
      const pct = comp?.paymentFeePercent;
      const fixedPerItem = comp?.paymentFixedPerItem;
      if ((typeof pct === 'number' && pct > 0) || (typeof fixedPerItem === 'number' && fixedPerItem > 0)) {
        const percentFee = pct ? (lineRevenue * pct) / 100 : 0;
        const fixedFee = fixedPerItem ? fixedPerItem * qty : 0;
        perVariantPaymentByDate[date] = (perVariantPaymentByDate[date] || 0) + roundMoney(percentFee + fixedFee);
        if (percentFee > 0) {
          perVariantPaymentRevenueCovered[date] = (perVariantPaymentRevenueCovered[date] || 0) + lineRevenue;
        }
      }
    }

    // Customer metrics
    if (order.customerId) {
      metrics.uniqueCustomers.add(order.customerId);
      // We don't have ordersCount on the order, need to query customer
      metrics.totalCustomers++;
    }
  }

  // Process Meta insights
  for (const insight of data.metaInsights) {
    const date = insight.date;

    if (!metricsByDate[date]) {
      metricsByDate[date] = initializeMetrics(date, data.organizationId);
    }

    const metrics = metricsByDate[date];

    // Ad spend
    metrics.metaAdSpend += roundMoney(insight.spend || 0);
    metrics.totalAdSpend += roundMoney(insight.spend || 0);

    // Performance metrics
    metrics.metaImpressions += insight.impressions || 0;
    metrics.metaClicks += insight.clicks || 0;
    metrics.metaConversions += insight.conversions || 0;
    metrics.metaConversionValue += roundMoney(insight.conversionValue || 0);
    metrics.metaUniqueClicks += insight.uniqueClicks || 0;
    metrics.metaAddToCart += insight.addToCart || 0;
    metrics.metaInitiateCheckout += insight.initiateCheckout || 0;
    metrics.metaPageViews += insight.pageViews || 0;
    metrics.metaViewContent += insight.viewContent || 0;
    // Removed Meta leads/registrations metrics per request
    metrics.metaLinkClicks += insight.linkClicks || 0;
    metrics.metaOutboundClicks += insight.outboundClicks || 0;
    metrics.metaLandingPageViews += insight.landingPageViews || 0;
    metrics.metaVideoViews += insight.videoViews || 0;
    metrics.metaVideo3SecViews += insight.video3SecViews || 0;
    metrics.metaVideoThruPlay += insight.videoThruPlay || 0;

    // Reach and frequency (use max for reach as it's unique users)
    if (insight.reach) {
      metrics.metaReach = Math.max(metrics.metaReach, insight.reach);
    }
    if (insight.frequency) {
      // Average frequency across the day
      metrics.metaFrequency =
        metrics.metaFrequency > 0
          ? (metrics.metaFrequency + insight.frequency) / 2
          : insight.frequency;
    }

    // Calculate rates (will be recalculated at the end for accuracy)
    metrics.metaCTR =
      metrics.metaImpressions > 0
        ? (metrics.metaClicks / metrics.metaImpressions) * 100
        : 0;
    metrics.metaCPC =
      metrics.metaClicks > 0 ? metrics.metaAdSpend / metrics.metaClicks : 0;
    metrics.metaCPM =
      metrics.metaImpressions > 0
        ? (metrics.metaAdSpend / metrics.metaImpressions) * 1000
        : 0;
    metrics.metaCostPerConversion =
      metrics.metaConversions > 0
        ? metrics.metaAdSpend / metrics.metaConversions
        : 0;
    metrics.metaCostPerThruPlay =
      metrics.metaVideoThruPlay > 0
        ? metrics.metaAdSpend / metrics.metaVideoThruPlay
        : 0;
  }

  // Process costs - apply to all dates that have orders
  // First, get all dates that have activity
  const activeDates = new Set(Object.keys(metricsByDate));
  // Compute the earliest active date for one-time allocations
  const earliestActiveDate = Array.from(activeDates).sort()[0];
  // Helpers for exact pro-rating by calendar
  const daysInMonth = (d: string): number => {
    const parts = d.split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]); // 1-12
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 30;
    return new Date(y, m, 0).getDate(); // day 0 gives last day of prior month; with m=1..12 yields correct month length
  };
  const daysInYear = (d: string): number => {
    const y = Number(d.split("-")[0]);
    if (!Number.isFinite(y)) return 365;
    const start = new Date(y, 0, 1).getTime();
    const end = new Date(y + 1, 0, 1).getTime();
    return Math.round((end - start) / (24 * 60 * 60 * 1000));
  };
  const daysInQuarter = (d: string): number => {
    const parts = d.split("-");
    const y = Number(parts[0]);
    const monthNum = Number(parts[1]); // 1-12
    if (!Number.isFinite(y) || !Number.isFinite(monthNum)) return 90;
    const mIndex = monthNum - 1; // 0-11
    const q = Math.floor(mIndex / 3);
    const startMonth = q * 3;
    const start = new Date(y, startMonth, 1).getTime();
    const end = new Date(y, startMonth + 3, 1).getTime();
    return Math.round((end - start) / (24 * 60 * 60 * 1000));
  };

  // Inject per-variant components before org-level defaults
  for (const date of Object.keys(metricsByDate)) {
    const m = metricsByDate[date]!;
    if (perVariantCogsByDate[date]) m.cogs += roundMoney(perVariantCogsByDate[date]);
    if (perVariantShippingByDate[date]) m.shippingCosts += roundMoney(perVariantShippingByDate[date]);
    if (perVariantHandlingByDate[date]) m.handlingFees += roundMoney(perVariantHandlingByDate[date]);
    if (perVariantPaymentByDate[date]) m.transactionFees += roundMoney(perVariantPaymentByDate[date]);
  }

  // Process costs and apply them appropriately
  for (const cost of data.costs) {
    const cfg = (cost as any)?.config || {};
    // Apply costs to relevant dates based on frequency and calculation type
    for (const date of activeDates) {
      // Respect cost effective range
      const dayTs = new Date(date).getTime();
      if (
        typeof (cost as any).effectiveFrom === "number" &&
        (cost as any).effectiveFrom > dayTs
      ) {
        continue;
      }
      if (
        typeof (cost as any).effectiveTo === "number" &&
        (cost as any).effectiveTo < dayTs
      ) {
        continue;
      }
      if (!metricsByDate[date]) {
        metricsByDate[date] = initializeMetrics(date, data.organizationId);
      }

      const metrics = metricsByDate[date]!;

      // Apply cost based on calculation type
      const frequency = (cost as any).frequency || cfg?.frequency;
      if (cost.calculation === "percentage") {
        // Apply percentage-based costs
        switch (cost.type) {
          case "product": // COGS
            {
              const covered = perVariantRevenueCoveredForCogs[date] || 0;
              const base = Math.max(0, metrics.grossSales - covered);
              metrics.cogs += percentageOfMoney(base, cost.value);
            }
            break;
          case "payment": // Transaction fees
            {
              const covered = perVariantPaymentRevenueCovered[date] || 0;
              const base = Math.max(0, metrics.revenue - covered);
              metrics.transactionFees += percentageOfMoney(base, cost.value);
            }
            // Include any fixed fee per transaction if configured
            if (typeof cfg.fixedFee === "number" && cfg.fixedFee > 0) {
              metrics.transactionFees += roundMoney(
                metrics.orders * cfg.fixedFee,
              );
            }
            break;
          case "tax":
            metrics.taxesPaid += percentageOfMoney(metrics.revenue, cost.value);
            break;
        }
      } else if (cost.calculation === "fixed") {
        // Apply fixed costs
        switch (frequency) {
          case "per_order":
            if (cost.type === "shipping") {
              metrics.shippingCosts += roundMoney(metrics.orders * cost.value);
            } else if (cost.type === "payment") {
              metrics.transactionFees += roundMoney(
                metrics.orders * cost.value,
              );
            } else if (cost.type === "handling") {
              metrics.handlingFees += roundMoney(metrics.orders * cost.value);
            } else if (cost.type === "tax") {
              metrics.taxesPaid += roundMoney(metrics.orders * cost.value);
            } else if (cost.type === "operational") {
              // Rare case: operational per order, include in customCosts
              metrics.customCosts += roundMoney(metrics.orders * cost.value);
            }
            break;
          case "per_item":
            // Per-item fixed costs multiply by units sold
            if (cost.type === "shipping") {
              metrics.shippingCosts += roundMoney(
                metrics.unitsSold * cost.value,
              );
            } else if (cost.type === "handling") {
              metrics.handlingFees += roundMoney(
                metrics.unitsSold * cost.value,
              );
            } else if (cost.type === "payment") {
              metrics.transactionFees += roundMoney(
                metrics.unitsSold * cost.value,
              );
            } else if (cost.type === "operational") {
              metrics.customCosts += roundMoney(
                metrics.unitsSold * cost.value,
              );
            }
            break;
          case "monthly":
            // Spread monthly costs across days in the month
            if (cost.type === "operational" || cost.type === "marketing") {
              const dim = daysInMonth(date);
              metrics.customCosts += roundMoney(cost.value / dim);
            }
            break;
          case "weekly":
            if (cost.type === "operational" || cost.type === "marketing") {
              metrics.customCosts += roundMoney(cost.value / 7);
            }
            break;
          case "daily":
            if (cost.type === "operational" || cost.type === "marketing") {
              metrics.customCosts += roundMoney(cost.value);
            }
            break;
          case "quarterly":
            if (cost.type === "operational" || cost.type === "marketing") {
              const diq = daysInQuarter(date);
              metrics.customCosts += roundMoney(cost.value / diq);
            }
            break;
          case "yearly":
            if (cost.type === "operational" || cost.type === "marketing") {
              const diy = daysInYear(date);
              metrics.customCosts += roundMoney(cost.value / diy);
            }
            break;
          case "one_time":
            if (
              (cost.type === "operational" || cost.type === "marketing") &&
              date === earliestActiveDate
            ) {
              metrics.customCosts += roundMoney(cost.value);
            }
            break;
        }
      } else if (cost.calculation === "per_unit") {
        // Treat per-unit costs similar to per-item fixed
        if (cost.type === "product") {
          metrics.cogs += roundMoney(metrics.unitsSold * cost.value);
        } else if (cost.type === "shipping") {
          metrics.shippingCosts += roundMoney(metrics.unitsSold * cost.value);
        } else if (cost.type === "handling") {
          metrics.handlingFees += roundMoney(metrics.unitsSold * cost.value);
        } else if (cost.type === "payment") {
          metrics.transactionFees += roundMoney(metrics.unitsSold * cost.value);
        } else if (cost.type === "operational") {
          metrics.customCosts += roundMoney(metrics.unitsSold * cost.value);
        }
      }
    }
  }

  // Calculate derived metrics and finalize
  return Object.values(metricsByDate).map((metrics) => {
    // Total costs
    metrics.totalCosts =
      metrics.cogs +
      metrics.handlingFees +
      metrics.totalAdSpend +
      metrics.shippingCosts +
      metrics.customCosts +
      metrics.transactionFees +
      metrics.taxesPaid;

    // Profit metrics
    metrics.grossProfit = metrics.grossSales - metrics.cogs;
    metrics.netProfit = metrics.revenue - metrics.totalCosts;

    // Margins
    metrics.grossProfitMargin =
      metrics.grossSales > 0
        ? (metrics.grossProfit / metrics.grossSales) * 100
        : 0;
    metrics.netProfitMargin =
      metrics.revenue > 0 ? (metrics.netProfit / metrics.revenue) * 100 : 0;

    // Contribution Margin (Revenue - Variable Costs)
    // Variable costs = COGS + Ad Spend + Shipping + Transaction Fees
    metrics.contributionMargin =
      metrics.revenue -
      (metrics.cogs +
        metrics.totalAdSpend +
        metrics.shippingCosts +
        metrics.transactionFees);

    metrics.contributionMarginPercentage =
      metrics.revenue > 0
        ? (metrics.contributionMargin / metrics.revenue) * 100
        : 0;

    // Discount Rate
    metrics.discountRate =
      metrics.grossSales > 0
        ? (metrics.discounts / metrics.grossSales) * 100
        : 0;

    // Averages
    metrics.avgOrderValue =
      metrics.orders > 0 ? metrics.revenue / metrics.orders : 0;
    metrics.avgOrderCost =
      metrics.orders > 0 ? metrics.totalCosts / metrics.orders : 0;
    metrics.avgOrderProfit =
      metrics.orders > 0 ? metrics.netProfit / metrics.orders : 0;
    metrics.adSpendPerOrder =
      metrics.orders > 0 ? metrics.totalAdSpend / metrics.orders : 0;

    // Customer metrics
    metrics.totalCustomers = metrics.uniqueCustomers.size;

    // For now, we'll estimate new vs returning based on simple logic
    // In a full implementation, we'd track customer first purchase dates
    // Estimate: 30% new, 70% returning for stores with customers
    if (metrics.totalCustomers > 0) {
      metrics.newCustomers = Math.max(
        1,
        Math.round(metrics.totalCustomers * 0.3),
      );
      metrics.returningCustomers =
        metrics.totalCustomers - metrics.newCustomers;
    } else {
      metrics.newCustomers = 0;
      metrics.returningCustomers = 0;
    }

    // Repeat Customer Rate
    metrics.repeatCustomerRate =
      metrics.totalCustomers > 0
        ? (metrics.returningCustomers / metrics.totalCustomers) * 100
        : 0;

    // Customer Acquisition Cost (CAC)
    metrics.customerAcquisitionCost =
      metrics.newCustomers > 0
        ? metrics.totalAdSpend / metrics.newCustomers
        : 0;

    // Convert Set to array for storage
    (metrics as any).uniqueCustomers = Array.from(metrics.uniqueCustomers);

    // ROAS
    metrics.blendedRoas = roundMoney(
      metrics.totalAdSpend > 0 ? metrics.revenue / metrics.totalAdSpend : 0,
    );
    metrics.metaROAS = roundMoney(
      metrics.metaAdSpend > 0
        ? (metrics.metaConversionValue > 0
            ? metrics.metaConversionValue
            : metrics.revenue) / metrics.metaAdSpend
        : 0,
    );
    metrics.googleROAS = roundMoney(
      metrics.googleAdSpend > 0 ? metrics.revenue / metrics.googleAdSpend : 0,
    );

    // Round all accumulated values before returning
    Object.keys(metrics).forEach((key) => {
      const value = (metrics as any)[key];
      if (
        typeof value === "number" &&
        key !== "orders" &&
        key !== "unitsSold" &&
        key !== "totalCustomers" &&
        key !== "newCustomers" &&
        key !== "returningCustomers"
      ) {
        (metrics as any)[key] = roundMoney(value);
      }
    });

    return metrics;
  });
}

/**
 * Initialize metrics object for a date
 */
function initializeMetrics(date: string, organizationId: string): DailyMetric {
  return {
    organizationId,
    date,

    // Revenue metrics
    revenue: 0,
    grossSales: 0,
    grossProfit: 0,
    netProfit: 0,
    discounts: 0,
    refunds: 0,

    // Cost metrics
    totalCosts: 0,
    cogs: 0,
    handlingFees: 0,
    totalAdSpend: 0,
    shippingCosts: 0,
    customCosts: 0,
    transactionFees: 0,
    taxesPaid: 0,

    // Order metrics
    orders: 0,
    unitsSold: 0,
    avgOrderValue: 0,
    avgOrderCost: 0,
    avgOrderProfit: 0,
    adSpendPerOrder: 0,

    // Customer metrics
    totalCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
    repeatCustomerRate: 0,
    customerAcquisitionCost: 0,
    uniqueCustomers: new Set(),

    // Platform metrics
    metaAdSpend: 0,
    metaImpressions: 0,
    metaClicks: 0,
    metaConversions: 0,
    metaConversionValue: 0,
    metaCTR: 0,
    metaCPC: 0,
    metaCPM: 0,
    metaReach: 0,
    metaFrequency: 0,
    metaUniqueClicks: 0,
    metaCostPerConversion: 0,
    metaAddToCart: 0,
    metaInitiateCheckout: 0,
    metaPageViews: 0,
    metaViewContent: 0,
    metaLinkClicks: 0,
    metaOutboundClicks: 0,
    metaLandingPageViews: 0,
    metaVideoViews: 0,
    metaVideo3SecViews: 0,
    metaVideoThruPlay: 0,
    metaCostPerThruPlay: 0,
    googleAdSpend: 0,

    // Other metrics
    shippingCharged: 0,
    taxesCollected: 0,
    returns: 0,

    // Calculated metrics
    grossProfitMargin: 0,
    netProfitMargin: 0,
    contributionMargin: 0,
    contributionMarginPercentage: 0,
    discountRate: 0,
    blendedRoas: 0,
    metaROAS: 0,
    googleROAS: 0,

    // Metadata
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Store calculated metric
 */
export const storeMetric = internalMutation({
  args: {
    organizationId: v.string(),
    date: v.string(),
    metrics: v.any(), // Simplified for now
  },
  handler: async (ctx, args) => {
    // Check if metric exists
    const existing = await ctx.db
      .query("metricsDaily")
      .withIndex("by_org_date", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("date", args.date),
      )
      .first();

    // Prepare metrics with all required fields and proper defaults
    const metricsToStore = {
      organizationId: args.organizationId,
      date: args.date,

      // General Metrics - ensure all required fields have values
      orders: args.metrics.orders || 0,
      unitsSold: args.metrics.unitsSold || 0,
      revenue: args.metrics.revenue || 0,
      totalCosts: args.metrics.totalCosts || 0,
      netProfit: args.metrics.netProfit || 0,
      netProfitMargin: args.metrics.netProfitMargin || 0,
      grossSales: args.metrics.grossSales || 0,
      grossProfit: args.metrics.grossProfit || 0,
      grossProfitMargin: args.metrics.grossProfitMargin || 0,
      discounts: args.metrics.discounts || 0,
      refunds: args.metrics.refunds || 0,

      // Cost Breakdown
      cogs: args.metrics.cogs || 0,
      handlingFees: args.metrics.handlingFees || 0,
      totalAdSpend: args.metrics.totalAdSpend || 0,
      shippingCosts: args.metrics.shippingCosts || 0,
      customCosts: args.metrics.customCosts || 0,
      transactionFees: args.metrics.transactionFees || 0,
      taxesPaid: args.metrics.taxesPaid || 0,

      // Order Summary
      avgOrderValue: args.metrics.avgOrderValue || 0,
      avgOrderCost: args.metrics.avgOrderCost || 0,
      avgOrderProfit: args.metrics.avgOrderProfit || 0,
      adSpendPerOrder: args.metrics.adSpendPerOrder || 0,
      purchaseFrequency: args.metrics.purchaseFrequency || 0,

      // Customer Summary
      totalCustomers: args.metrics.totalCustomers || 0,
      newCustomers: args.metrics.newCustomers || 0,
      returningCustomers: args.metrics.returningCustomers || 0,
      repeatCustomerRate: args.metrics.repeatCustomerRate || 0,
      customerAcquisitionCost: args.metrics.customerAcquisitionCost || 0,

      // Others
      shippingCharged: args.metrics.shippingCharged || 0,
      taxesCollected: args.metrics.taxesCollected || 0,
      
      returns: args.metrics.returns || 0,

      // Total Ad Spend (blendedAdSpend should be same as totalAdSpend)
      blendedAdSpend: args.metrics.totalAdSpend || 0,
      blendedRoas: args.metrics.blendedRoas || 0,

      // Contribution Margin and Discount Rate
      contributionMargin: args.metrics.contributionMargin || 0,
      contributionMarginPercentage:
        args.metrics.contributionMarginPercentage || 0,
      discountRate: args.metrics.discountRate || 0,

      // Optional fields with undefined as default
      metaAdSpend: args.metrics.metaAdSpend,
      metaImpressions: args.metrics.metaImpressions || 0,
      metaReach: args.metrics.metaReach || 0,
      metaFrequency: args.metrics.metaFrequency || 0,
      metaUniqueClicks: args.metrics.metaUniqueClicks || 0,
      metaClicks: args.metrics.metaClicks || 0,
      metaPurchases: args.metrics.metaConversions || 0, // Map conversions to purchases for metricsDaily
      metaConversionRate:
        args.metrics.metaConversions && args.metrics.metaClicks
          ? (args.metrics.metaConversions / args.metrics.metaClicks) * 100
          : 0,
      metaCTR: args.metrics.metaCTR || 0,
      metaCPC: args.metrics.metaCPC || 0,
      metaCPM: args.metrics.metaCPM || 0,
      metaCostPerConversion: args.metrics.metaCostPerConversion || 0,
      metaAddToCart: args.metrics.metaAddToCart || 0,
      metaInitiateCheckout: args.metrics.metaInitiateCheckout || 0,
      metaPageViews: args.metrics.metaPageViews || 0,
      metaViewContent: args.metrics.metaViewContent || 0,
      
      metaLinkClicks: args.metrics.metaLinkClicks || 0,
      metaOutboundClicks: args.metrics.metaOutboundClicks || 0,
      metaLandingPageViews: args.metrics.metaLandingPageViews || 0,
      metaVideoViews: args.metrics.metaVideoViews || 0,
      metaVideo3SecViews: args.metrics.metaVideo3SecViews || 0,
      metaVideoThruPlay: args.metrics.metaVideoThruPlay || 0,
      metaCostPerThruPlay: args.metrics.metaCostPerThruPlay || 0,
      googleAdSpend: args.metrics.googleAdSpend,
      metaROAS: args.metrics.metaROAS,
      googleROAS: args.metrics.googleROAS,

      // Metadata
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, metricsToStore as any);
    } else {
      await ctx.db.insert("metricsDaily", metricsToStore as any);
    }

    return null;
  },
});

/**
 * Calculate weekly and monthly aggregations
 */
export const calculateAggregations = internalMutation({
  args: {
    organizationId: v.string(),
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get daily metrics for the range
    const dailyMetrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    // Group by week and month
    const weeklyMetrics: Record<string, AggregateMetric> = {};
    const monthlyMetrics: Record<string, AggregateMetric> = {};

    for (const metric of dailyMetrics) {
      // Weekly aggregation
      const weekKey = getWeekKey(metric.date);

      if (!weeklyMetrics[weekKey]) {
        weeklyMetrics[weekKey] = initializeAggregateMetric(
          weekKey,
          "week",
          args.organizationId,
        ) as AggregateMetric;
      }
      aggregateMetric(weeklyMetrics[weekKey], metric as any);

      // Monthly aggregation
      const monthKey = getMonthKey(metric.date);

      if (!monthlyMetrics[monthKey]) {
        monthlyMetrics[monthKey] = initializeAggregateMetric(
          monthKey,
          "month",
          args.organizationId,
        ) as AggregateMetric;
      }
      aggregateMetric(monthlyMetrics[monthKey], metric as any);
    }

    // Store aggregations
    for (const metric of Object.values(weeklyMetrics)) {
      await ctx.runMutation(internal.engine.analytics.storeWeeklyMetric, {
        metric,
      });
    }

    for (const metric of Object.values(monthlyMetrics)) {
      await ctx.runMutation(internal.engine.analytics.storeMonthlyMetric, {
        metric,
      });
    }

    return null;
  },
});

/**
 * Update realtime metrics (current day cache)
 */
export const updateRealtimeMetrics = internalMutation({
  args: {
    organizationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const today = new Date().toISOString().substring(0, 10);

    // Get today's metrics
    const todayMetrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_org_date", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("date", today),
      )
      .first();

    if (!todayMetrics) return;

    // Update realtime cache
    const realtimeMetrics = [
      { metric: "revenue_today", value: todayMetrics.revenue },
      { metric: "orders_today", value: todayMetrics.orders },
      { metric: "profit_today", value: todayMetrics.netProfit },
      { metric: "customers_today", value: todayMetrics.totalCustomers },
      { metric: "ad_spend_today", value: todayMetrics.totalAdSpend },
      { metric: "roas_today", value: todayMetrics.blendedRoas },
    ];

    for (const metric of realtimeMetrics) {
      // Get all records first, then filter in memory
      const allMetrics = await ctx.db
        .query("realtimeMetrics")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">),
        )
        .collect();

      const existing = allMetrics.find((m) => m.metricType === metric.metric);

      if (existing) {
        await ctx.db.patch(existing._id, {
          value: metric.value,
          calculatedAt: Date.now(),
          ttl: 300, // 5 minute TTL
        });
      } else {
        await ctx.db.insert("realtimeMetrics", {
          organizationId: args.organizationId as Id<"organizations">,
          metricType: metric.metric,
          value: metric.value,
          period: "today",
          calculatedAt: Date.now(),
          ttl: 300, // 5 minute TTL
        });
      }
    }
  },
});

// Helper functions

function getDateRange(input?: {
  startDate?: string;
  endDate?: string;
  daysBack?: number;
}): { startDate: string; endDate: string } {
  if (input?.startDate && input?.endDate) {
    return {
      startDate: input.startDate,
      endDate: input.endDate,
    };
  }

  const endDate = new Date();
  const startDate = new Date();

  startDate.setDate(startDate.getDate() - (input?.daysBack || 30));

  return {
    startDate: startDate.toISOString().substring(0, 10),
    endDate: endDate.toISOString().substring(0, 10),
  };
}

function getWeekKey(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = getWeekNumber(d);

  return `${year}-W${week.toString().padStart(2, "0")}`;
}

function getMonthKey(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  return `${year}-${month.toString().padStart(2, "0")}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;

  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

type AggregateMetric = {
  key: string;
  type: "week" | "month";
  organizationId?: string;
  revenue: number;
  costs: number;
  profit: number;
  orders: number;
  customers: Array<string>;
  daysIncluded: number;
  unitsSold: number;
  grossSales: number;
  grossProfit: number;
  discounts: number;
  refunds: number;
  cogs: number;
  handlingFees: number;
  totalAdSpend: number;
  shippingCosts: number;
  customCosts: number;
  transactionFees: number;
  taxesPaid: number;
  shippingCharged: number;
  taxesCollected: number;
  returns: number;
  newCustomers: number;
  returningCustomers: number;
  customerAcquisitionCost: number;
  // Meta aggregates
  metaAdSpend?: number;
  metaImpressions?: number;
  metaReach?: number;
  metaClicks?: number;
  metaPurchases?: number;
  metaFrequency?: number; // derived later from impressions/reach
  metaUniqueClicks?: number;
  metaCTR?: number; // derived
  metaCPC?: number; // derived
  metaCPM?: number; // derived
  metaCostPerConversion?: number; // derived
  metaAddToCart?: number;
  metaInitiateCheckout?: number;
  metaPageViews?: number;
  metaViewContent?: number;
  metaLinkClicks?: number;
  metaOutboundClicks?: number;
  metaLandingPageViews?: number;
  metaVideoViews?: number;
  metaVideo3SecViews?: number;
  metaVideoThruPlay?: number;
  metaCostPerThruPlay?: number; // derived
};

function initializeAggregateMetric(
  key: string,
  type: "week" | "month",
  organizationId?: string,
): AggregateMetric {
  return {
    key,
    type,
    organizationId,
    revenue: 0,
    costs: 0,
    profit: 0,
    orders: 0,
    customers: [],
    daysIncluded: 0,

    // Initialize all other fields needed for aggregation
    unitsSold: 0,
    grossSales: 0,
    grossProfit: 0,
    discounts: 0,
    refunds: 0,

    // Costs
    cogs: 0,
    handlingFees: 0,
    totalAdSpend: 0,
    shippingCosts: 0,
    customCosts: 0,
    transactionFees: 0,
    taxesPaid: 0,

    // Others
    shippingCharged: 0,
    taxesCollected: 0,
    returns: 0,

    // Customer metrics
    newCustomers: 0,
    returningCustomers: 0,
    customerAcquisitionCost: 0,
    // Meta
    metaAdSpend: 0,
    metaImpressions: 0,
    metaReach: 0,
    metaClicks: 0,
    metaPurchases: 0,
    metaUniqueClicks: 0,
    metaAddToCart: 0,
    metaInitiateCheckout: 0,
    metaPageViews: 0,
    metaViewContent: 0,
    metaLinkClicks: 0,
    metaOutboundClicks: 0,
    metaLandingPageViews: 0,
    metaVideoViews: 0,
    metaVideo3SecViews: 0,
    metaVideoThruPlay: 0,
  };
}

function aggregateMetric(aggregate: AggregateMetric, daily: DailyMetric): void {
  // Core metrics
  aggregate.revenue += daily.revenue || 0;
  aggregate.costs += daily.totalCosts || 0;
  aggregate.profit += daily.netProfit || 0;
  aggregate.orders += daily.orders || 0;
  aggregate.unitsSold += daily.unitsSold || 0;
  aggregate.daysIncluded++;

  // Revenue breakdown
  aggregate.grossSales += daily.grossSales || 0;
  aggregate.grossProfit += daily.grossProfit || 0;
  aggregate.discounts += daily.discounts || 0;
  aggregate.refunds += daily.refunds || 0;

  // Cost breakdown
  aggregate.cogs += daily.cogs || 0;
  aggregate.handlingFees += daily.handlingFees || 0;
  aggregate.totalAdSpend += daily.totalAdSpend || 0;
  // Meta aggregates
  aggregate.metaAdSpend = (aggregate.metaAdSpend || 0) + (daily.metaAdSpend || 0);
  aggregate.metaImpressions =
    (aggregate.metaImpressions || 0) + (daily.metaImpressions || 0);
  aggregate.metaReach = (aggregate.metaReach || 0) + (daily.metaReach || 0);
  aggregate.metaClicks = (aggregate.metaClicks || 0) + (daily.metaClicks || 0);
  aggregate.metaPurchases =
    (aggregate.metaPurchases || 0) + (daily.metaConversions || 0);
  aggregate.metaUniqueClicks =
    (aggregate.metaUniqueClicks || 0) + (daily.metaUniqueClicks || 0);
  aggregate.metaAddToCart =
    (aggregate.metaAddToCart || 0) + (daily.metaAddToCart || 0);
  aggregate.metaInitiateCheckout =
    (aggregate.metaInitiateCheckout || 0) + (daily.metaInitiateCheckout || 0);
  aggregate.metaPageViews =
    (aggregate.metaPageViews || 0) + (daily.metaPageViews || 0);
  aggregate.metaViewContent =
    (aggregate.metaViewContent || 0) + (daily.metaViewContent || 0);
  // Removed Meta leads/registrations aggregation per request
  aggregate.metaLinkClicks =
    (aggregate.metaLinkClicks || 0) + (daily.metaLinkClicks || 0);
  aggregate.metaOutboundClicks =
    (aggregate.metaOutboundClicks || 0) + (daily.metaOutboundClicks || 0);
  aggregate.metaLandingPageViews =
    (aggregate.metaLandingPageViews || 0) + (daily.metaLandingPageViews || 0);
  aggregate.metaVideoViews =
    (aggregate.metaVideoViews || 0) + (daily.metaVideoViews || 0);
  aggregate.metaVideo3SecViews =
    (aggregate.metaVideo3SecViews || 0) + (daily.metaVideo3SecViews || 0);
  aggregate.metaVideoThruPlay =
    (aggregate.metaVideoThruPlay || 0) + (daily.metaVideoThruPlay || 0);
  aggregate.shippingCosts += daily.shippingCosts || 0;
  aggregate.customCosts += daily.customCosts || 0;
  aggregate.transactionFees += daily.transactionFees || 0;
  aggregate.taxesPaid += daily.taxesPaid || 0;

  // Others
  aggregate.shippingCharged += daily.shippingCharged || 0;
  aggregate.taxesCollected += daily.taxesCollected || 0;
  // Removed tips and gift card sales aggregation per request
  aggregate.returns += daily.returns || 0;

  // Customer metrics
  aggregate.newCustomers += daily.newCustomers || 0;
  aggregate.returningCustomers += daily.returningCustomers || 0;

  // Track unique customers
  if (daily.totalCustomers > 0) {
    aggregate.customers.push(daily.date); // Track by date
  }
}

export const storeWeeklyMetric = internalMutation({
  args: {
    metric: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const metric = args.metric;
    const weekKey = metric.key; // e.g., "2024-W52"

    // Parse week key to get start and end dates
    const [year, weekStr] = weekKey.split("-W");
    const weekNum = parseInt(weekStr, 10);

    // Calculate start and end dates of the week
    const startDate = getWeekStartDate(parseInt(year, 10), weekNum);
    const endDate = new Date(startDate);

    endDate.setDate(endDate.getDate() + 6);

    // Check if weekly metric exists
    const existing = await ctx.db
      .query("metricsWeekly")
      .withIndex("by_org_week", (q) =>
        q.eq("organizationId", metric.organizationId).eq("yearWeek", weekKey),
      )
      .first();

    // Prepare weekly metrics
    const weeklyMetrics = {
      organizationId: metric.organizationId,
      yearWeek: weekKey,
      startDate: startDate.toISOString().substring(0, 10),
      endDate: endDate.toISOString().substring(0, 10),

      // Aggregate metrics
      orders: metric.orders || 0,
      unitsSold: metric.unitsSold || 0,
      revenue: metric.revenue || 0,
      totalCosts: metric.costs || 0,
      netProfit: metric.profit || 0,
      netProfitMargin:
        metric.revenue > 0 ? (metric.profit / metric.revenue) * 100 : 0,
      grossSales: metric.grossSales || 0,
      grossProfit: metric.grossProfit || 0,
      grossProfitMargin:
        metric.grossSales > 0
          ? (metric.grossProfit / metric.grossSales) * 100
          : 0,
      discounts: metric.discounts || 0,
      refunds: metric.refunds || 0,

      // Cost breakdown
      cogs: metric.cogs || 0,
      handlingFees: metric.handlingFees || 0,
      totalAdSpend: metric.totalAdSpend || 0,
      shippingCosts: metric.shippingCosts || 0,
      customCosts: metric.customCosts || 0,
      transactionFees: metric.transactionFees || 0,
      taxesPaid: metric.taxesPaid || 0,

      // Averages
      avgOrderValue: metric.orders > 0 ? metric.revenue / metric.orders : 0,
      avgOrderCost: metric.orders > 0 ? metric.costs / metric.orders : 0,
      avgOrderProfit: metric.orders > 0 ? metric.profit / metric.orders : 0,
      adSpendPerOrder:
        metric.orders > 0 ? metric.totalAdSpend / metric.orders : 0,
      purchaseFrequency: 0,

      // Customer metrics
      totalCustomers: metric.customers?.size || 0,
      newCustomers: metric.newCustomers || 0,
      returningCustomers: metric.returningCustomers || 0,
      customerAcquisitionCost: metric.customerAcquisitionCost || 0,

      // Others
      shippingCharged: metric.shippingCharged || 0,
      taxesCollected: metric.taxesCollected || 0,
      
      returns: metric.returns || 0,

      // Ad spend breakdown
      blendedAdSpend: metric.totalAdSpend || 0,
      blendedRoas: roundMoney(
        metric.totalAdSpend > 0 ? metric.revenue / metric.totalAdSpend : 0,
      ),

      // Meta detailed (aggregated)
      metaAdSpend: metric.metaAdSpend || 0,
      metaImpressions: metric.metaImpressions || 0,
      metaReach: metric.metaReach || 0,
      metaFrequency:
        (metric.metaReach || 0) > 0
          ? (metric.metaImpressions || 0) / (metric.metaReach || 1)
          : 0,
      metaUniqueClicks: metric.metaUniqueClicks || 0,
      metaClicks: metric.metaClicks || 0,
      metaPurchases: metric.metaPurchases || 0,
      metaCTR:
        (metric.metaImpressions || 0) > 0
          ? ((metric.metaClicks || 0) / (metric.metaImpressions || 1)) * 100
          : 0,
      metaCPC:
        (metric.metaClicks || 0) > 0
          ? (metric.metaAdSpend || 0) / (metric.metaClicks || 1)
          : 0,
      metaCPM:
        (metric.metaImpressions || 0) > 0
          ? ((metric.metaAdSpend || 0) / (metric.metaImpressions || 1)) * 1000
          : 0,
      metaCostPerConversion:
        (metric.metaPurchases || 0) > 0
          ? (metric.metaAdSpend || 0) / (metric.metaPurchases || 1)
          : 0,
      metaAddToCart: metric.metaAddToCart || 0,
      metaInitiateCheckout: metric.metaInitiateCheckout || 0,
      metaPageViews: metric.metaPageViews || 0,
      metaViewContent: metric.metaViewContent || 0,
      
      metaLinkClicks: metric.metaLinkClicks || 0,
      metaOutboundClicks: metric.metaOutboundClicks || 0,
      metaLandingPageViews: metric.metaLandingPageViews || 0,
      metaVideoViews: metric.metaVideoViews || 0,
      metaVideo3SecViews: metric.metaVideo3SecViews || 0,
      metaVideoThruPlay: metric.metaVideoThruPlay || 0,
      metaCostPerThruPlay:
        (metric.metaVideoThruPlay || 0) > 0
          ? (metric.metaAdSpend || 0) / (metric.metaVideoThruPlay || 1)
          : 0,

      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, weeklyMetrics);
    } else {
      await ctx.db.insert("metricsWeekly", weeklyMetrics);
    }

    return null;
  },
});

export const storeMonthlyMetric = internalMutation({
  args: {
    metric: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const metric = args.metric;
    const monthKey = metric.key; // e.g., "2024-12"

    // Check if monthly metric exists
    const existing = await ctx.db
      .query("metricsMonthly")
      .withIndex("by_org_month", (q) =>
        q.eq("organizationId", metric.organizationId).eq("yearMonth", monthKey),
      )
      .first();

    // Prepare monthly metrics
    const monthlyMetrics = {
      organizationId: metric.organizationId,
      yearMonth: monthKey,

      // Aggregate metrics
      orders: metric.orders || 0,
      unitsSold: metric.unitsSold || 0,
      revenue: metric.revenue || 0,
      totalCosts: metric.costs || 0,
      netProfit: metric.profit || 0,
      netProfitMargin:
        metric.revenue > 0 ? (metric.profit / metric.revenue) * 100 : 0,
      grossSales: metric.grossSales || 0,
      grossProfit: metric.grossProfit || 0,
      grossProfitMargin:
        metric.grossSales > 0
          ? (metric.grossProfit / metric.grossSales) * 100
          : 0,
      discounts: metric.discounts || 0,
      refunds: metric.refunds || 0,

      // Cost breakdown
      cogs: metric.cogs || 0,
      handlingFees: metric.handlingFees || 0,
      totalAdSpend: metric.totalAdSpend || 0,
      shippingCosts: metric.shippingCosts || 0,
      customCosts: metric.customCosts || 0,
      transactionFees: metric.transactionFees || 0,
      taxesPaid: metric.taxesPaid || 0,

      // Averages
      avgOrderValue: metric.orders > 0 ? metric.revenue / metric.orders : 0,
      avgOrderCost: metric.orders > 0 ? metric.costs / metric.orders : 0,
      avgOrderProfit: metric.orders > 0 ? metric.profit / metric.orders : 0,
      adSpendPerOrder:
        metric.orders > 0 ? metric.totalAdSpend / metric.orders : 0,
      purchaseFrequency: 0,

      // Customer metrics
      totalCustomers: metric.customers?.size || 0,
      newCustomers: metric.newCustomers || 0,
      returningCustomers: metric.returningCustomers || 0,
      customerAcquisitionCost: metric.customerAcquisitionCost || 0,

      // Others
      shippingCharged: metric.shippingCharged || 0,
      taxesCollected: metric.taxesCollected || 0,
      
      returns: metric.returns || 0,

      // Ad spend breakdown
      blendedAdSpend: metric.totalAdSpend || 0,
      blendedRoas: roundMoney(
        metric.totalAdSpend > 0 ? metric.revenue / metric.totalAdSpend : 0,
      ),

      // Meta detailed (aggregated)
      metaAdSpend: metric.metaAdSpend || 0,
      metaImpressions: metric.metaImpressions || 0,
      metaReach: metric.metaReach || 0,
      metaFrequency:
        (metric.metaReach || 0) > 0
          ? (metric.metaImpressions || 0) / (metric.metaReach || 1)
          : 0,
      metaUniqueClicks: metric.metaUniqueClicks || 0,
      metaClicks: metric.metaClicks || 0,
      metaPurchases: metric.metaPurchases || 0,
      metaCTR:
        (metric.metaImpressions || 0) > 0
          ? ((metric.metaClicks || 0) / (metric.metaImpressions || 1)) * 100
          : 0,
      metaCPC:
        (metric.metaClicks || 0) > 0
          ? (metric.metaAdSpend || 0) / (metric.metaClicks || 1)
          : 0,
      metaCPM:
        (metric.metaImpressions || 0) > 0
          ? ((metric.metaAdSpend || 0) / (metric.metaImpressions || 1)) * 1000
          : 0,
      metaCostPerConversion:
        (metric.metaPurchases || 0) > 0
          ? (metric.metaAdSpend || 0) / (metric.metaPurchases || 1)
          : 0,
      metaAddToCart: metric.metaAddToCart || 0,
      metaInitiateCheckout: metric.metaInitiateCheckout || 0,
      metaPageViews: metric.metaPageViews || 0,
      metaViewContent: metric.metaViewContent || 0,
      
      metaLinkClicks: metric.metaLinkClicks || 0,
      metaOutboundClicks: metric.metaOutboundClicks || 0,
      metaLandingPageViews: metric.metaLandingPageViews || 0,
      metaVideoViews: metric.metaVideoViews || 0,
      metaVideo3SecViews: metric.metaVideo3SecViews || 0,
      metaVideoThruPlay: metric.metaVideoThruPlay || 0,
      metaCostPerThruPlay:
        (metric.metaVideoThruPlay || 0) > 0
          ? (metric.metaAdSpend || 0) / (metric.metaVideoThruPlay || 1)
          : 0,

      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, monthlyMetrics);
    } else {
      await ctx.db.insert("metricsMonthly", monthlyMetrics);
    }

    return null;
  },
});

// Helper function to get week start date
function getWeekStartDate(year: number, week: number): Date {
  const date = new Date(year, 0, 1);
  const dayOfWeek = date.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  date.setDate(date.getDate() + daysToMonday + (week - 1) * 7);

  return date;
}
