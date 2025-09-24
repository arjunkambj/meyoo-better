import type { GenericQueryCtx } from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

/**
 * Dashboard API
 * Provides data for dashboard widgets and summaries
 */

/**
 * Get dashboard summary
 */
export const getDashboardSummary = query({
  args: {
    timeRange: v.optional(v.string()), // "today", "7d", "30d", "90d"
    startDate: v.optional(v.string()), // Custom start date YYYY-MM-DD
    endDate: v.optional(v.string()), // Custom end date YYYY-MM-DD
  },
  returns: v.union(
    v.null(),
    v.object({
      revenue: v.float64(),
      revenueChange: v.float64(),
      profit: v.float64(),
      profitChange: v.float64(),
      orders: v.float64(),
      ordersChange: v.float64(),
      customers: v.float64(),
      customersChange: v.float64(),
      products: v.float64(),
      productsChange: v.float64(),
      adSpend: v.float64(),
      adSpendChange: v.float64(),
      profitMargin: v.float64(),
      profitMarginChange: v.float64(),
      avgOrderValue: v.float64(),
      avgOrderValueChange: v.float64(),
      roas: v.float64(),
      roasChange: v.float64(),
      poas: v.float64(),
      poasChange: v.float64(),
      ncROAS: v.float64(),
      ncROASChange: v.float64(),
      adSpendPerOrder: v.float64(),
      adSpendPerOrderChange: v.float64(),
      avgOrderProfit: v.float64(),
      avgOrderProfitChange: v.float64(),
      avgOrderCost: v.float64(),
      avgOrderCostChange: v.float64(),
      customerAcquisitionCost: v.float64(),
      customerAcquisitionCostChange: v.float64(),
      // Additional metrics
      grossSales: v.float64(),
      grossSalesChange: v.float64(),
      grossProfit: v.float64(),
      grossProfitChange: v.float64(),
      grossProfitMargin: v.float64(),
      grossProfitMarginChange: v.float64(),
      discounts: v.float64(),
      discountsChange: v.float64(),
      discountRate: v.float64(),
      discountRateChange: v.float64(),
      cogs: v.float64(),
      cogsChange: v.float64(),
      shippingCosts: v.float64(),
      shippingCostsChange: v.float64(),
      handlingFees: v.float64(),
      handlingFeesChange: v.float64(),
      customCosts: v.float64(),
      customCostsChange: v.float64(),
      transactionFees: v.float64(),
      transactionFeesChange: v.float64(),
      taxesCollected: v.float64(),
      taxesCollectedChange: v.float64(),
      metaAdSpend: v.float64(),
      metaAdSpendChange: v.float64(),
      googleAdSpend: v.float64(),
      googleAdSpendChange: v.float64(),
      contributionMargin: v.float64(),
      contributionMarginChange: v.float64(),
      contributionMarginPercentage: v.float64(),
      contributionMarginPercentageChange: v.float64(),
      metaROAS: v.float64(),
      metaROASChange: v.float64(),
      googleROAS: v.float64(),
      googleROASChange: v.float64(),
      metaSpendPercentage: v.float64(),
      metaSpendPercentageChange: v.float64(),
      googleSpendPercentage: v.float64(),
      googleSpendPercentageChange: v.float64(),
      unitsSold: v.float64(),
      unitsSoldChange: v.float64(),
      newCustomers: v.float64(),
      newCustomersChange: v.float64(),
      returningCustomers: v.float64(),
      returningCustomersChange: v.float64(),
      repeatCustomerRate: v.float64(),
      repeatCustomerRateChange: v.float64(),
      returnRate: v.float64(),
      returnRateChange: v.float64(),
      // Strict calendar month-over-month growth (revenue)
      calendarMoMRevenueGrowth: v.float64(),
      period: v.object({
        start: v.string(),
        end: v.string(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const organizationId = auth.orgId;

    // Calculate date range - prefer custom dates over preset timeRange
    let endDateStr: string;
    let startDateStr: string;

    if (args.startDate && args.endDate) {
      // Use custom date range if provided
      startDateStr = args.startDate;
      endDateStr = args.endDate;
      // production: avoid noisy dashboard logs
    } else {
      // Fall back to timeRange presets
      const endDate = new Date();
      const startDate = new Date();

      switch (args.timeRange || "30d") {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "7d":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      startDateStr = startDate.toISOString().substring(0, 10);
      endDateStr = endDate.toISOString().substring(0, 10);
      // production: avoid noisy dashboard logs
    }

    // Get all metrics for this organization
    const allOrgMetrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    // production: avoid noisy dashboard logs

    // Calculate previous period dates for comparison
    const currentStart = new Date(startDateStr);
    const currentEnd = new Date(endDateStr);
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - periodLength);
    const previousEnd = new Date(currentStart.getTime() - 1);

    const previousStartStr = previousStart.toISOString().substring(0, 10);
    const previousEndStr = previousEnd.toISOString().substring(0, 10);

    // Filter metrics for current and previous periods
    const metrics = allOrgMetrics.filter(
      (m) => m.date >= startDateStr && m.date <= endDateStr,
    );

    const previousMetrics = allOrgMetrics.filter(
      (m) => m.date >= previousStartStr && m.date <= previousEndStr,
    );

    // production: avoid noisy dashboard logs

    // If no metrics found, try to get raw data from Shopify orders for basic calculations
    if (metrics.length === 0) {
      // Get orders directly to at least show something
      const orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();

      const filteredOrders = orders.filter((order) => {
        const orderDate = new Date(order.shopifyCreatedAt)
          .toISOString()
          .substring(0, 10);

        return orderDate >= startDateStr && orderDate <= endDateStr;
      });

      // Calculate basic metrics from orders
      const revenue = filteredOrders.reduce(
        (sum, o) => sum + (o.totalPrice || 0),
        0,
      );
      const orderCount = filteredOrders.length;
      const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      // Get Meta insights for ad spend
      const metaInsights = await ctx.db
        .query("metaInsights")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();

      const filteredInsights = metaInsights.filter(
        (i) => i.date >= startDateStr && i.date <= endDateStr,
      );

      const adSpend = filteredInsights.reduce(
        (sum, i) => sum + parseFloat(String(i.spend || "0")),
        0,
      );
      const roas = adSpend > 0 ? revenue / adSpend : 0;

      // Calculate basic metrics from orders with actual discounts
      const discounts = filteredOrders.reduce(
        (sum, o) => sum + (o.totalDiscounts || 0),
        0,
      );
      const grossSales = filteredOrders.reduce(
        (sum, o) => sum + (o.subtotalPrice || 0),
        0,
      );
      const discountRate = grossSales > 0 ? (discounts / grossSales) * 100 : 0;

      // Estimate costs and margins when analytics not available
      const cogs = grossSales * 0.5; // Estimate 50% COGS
      const shippingCosts = filteredOrders.reduce(
        (sum, o) => sum + (o.totalShippingPrice || 0),
        0,
      );
      const transactionFees = revenue * 0.029; // 2.9% typical fee
      const totalCosts = cogs + adSpend + shippingCosts + transactionFees;
      const grossProfit = grossSales - cogs;
      const netProfit = revenue - totalCosts;
      const contributionMargin =
        revenue - (cogs + adSpend + shippingCosts + transactionFees);
      const poas = adSpend > 0 ? netProfit / adSpend : 0;
      const avgOrderProfit = orderCount > 0 ? netProfit / orderCount : 0;
      const avgOrderCost = avgOrderValue - avgOrderProfit;
      const adSpendPerOrder = orderCount > 0 ? adSpend / orderCount : 0;

      // Count unique customers
      const uniqueCustomers = new Set(
        filteredOrders.map((o) => o.customerId).filter(Boolean),
      );
      const customerCount = uniqueCustomers.size;

      // Estimate new vs returning (30% new, 70% returning)
      // Only calculate if there are actual customers
      const newCustomers =
        customerCount > 0 ? Math.round(customerCount * 0.3) : 0;
      const returningCustomers =
        customerCount > 0 ? customerCount - newCustomers : 0;
      const customerAcquisitionCost =
        newCustomers > 0 ? adSpend / newCustomers : 0;

      // Compute strict calendar MoM revenue growth using endDateStr's month
      const end = new Date(endDateStr);
      const currentMonthStart = new Date(end.getFullYear(), end.getMonth(), 1)
        .toISOString()
        .substring(0, 10);
      const currentMonthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0)
        .toISOString()
        .substring(0, 10);
      const previousMonthStart = new Date(end.getFullYear(), end.getMonth() - 1, 1)
        .toISOString()
        .substring(0, 10);
      const previousMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0)
        .toISOString()
        .substring(0, 10);

      const currentMonthOrders = filteredOrders.filter((o) => {
        const d = o.shopifyCreatedAt
          ? new Date(o.shopifyCreatedAt).toISOString().substring(0, 10)
          : null;
        return d && d >= currentMonthStart && d <= currentMonthEnd;
      });
      const previousMonthOrders = filteredOrders.filter((o) => {
        const d = o.shopifyCreatedAt
          ? new Date(o.shopifyCreatedAt).toISOString().substring(0, 10)
          : null;
        return d && d >= previousMonthStart && d <= previousMonthEnd;
      });
      const currentMonthRevenue = currentMonthOrders.reduce(
        (sum, o) => sum + (o.totalPrice || 0),
        0,
      );
      const previousMonthRevenue = previousMonthOrders.reduce(
        (sum, o) => sum + (o.totalPrice || 0),
        0,
      );
      const calendarMoMRevenueGrowth =
        previousMonthRevenue > 0
          ? ((currentMonthRevenue - previousMonthRevenue) /
              previousMonthRevenue) *
            100
          : 0;

      const returnedOrders = filteredOrders.filter((o) => {
        const status = (o.financialStatus ?? "").toString().toLowerCase();

        return status === "refunded" || status === "partially_refunded";
      }).length;
      const returnRate =
        orderCount > 0 ? (returnedOrders / orderCount) * 100 : 0;
      const repeatCustomerRate =
        customerCount > 0
          ? (returningCustomers / customerCount) * 100
          : 0;

      const ncROAS =
        newCustomers > 0 && adSpend > 0 && avgOrderValue > 0
          ? (avgOrderValue * newCustomers) / adSpend
          : 0;

      return {
        revenue,
        revenueChange: 0,
        profit: netProfit,
        profitChange: 0,
        orders: orderCount,
        ordersChange: 0,
        customers: customerCount,
        customersChange: 0,
        products: 0,
        productsChange: 0,
        adSpend,
        adSpendChange: 0,
        profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        profitMarginChange: 0,
        avgOrderValue,
        avgOrderValueChange: 0,
        roas,
        roasChange: 0,
        poas,
        poasChange: 0,
        ncROAS,
        ncROASChange: 0,
        adSpendPerOrder,
        adSpendPerOrderChange: 0,
        avgOrderProfit,
        avgOrderProfitChange: 0,
        avgOrderCost,
        avgOrderCostChange: 0,
        customerAcquisitionCost,
        customerAcquisitionCostChange: 0,
        grossSales,
        grossSalesChange: 0,
        grossProfit,
        grossProfitChange: 0,
        grossProfitMargin:
          grossSales > 0 ? (grossProfit / grossSales) * 100 : 0,
        grossProfitMarginChange: 0,
        discounts,
        discountsChange: 0,
        discountRate,
        discountRateChange: 0,
        cogs,
        cogsChange: 0,
        shippingCosts,
        shippingCostsChange: 0,
        handlingFees: 0,
        handlingFeesChange: 0,
        customCosts: 0,
        customCostsChange: 0,
        transactionFees,
        transactionFeesChange: 0,
        taxesCollected: filteredOrders.reduce(
          (sum, o) => sum + (o.totalTax || 0),
          0,
        ),
        taxesCollectedChange: 0,
        metaAdSpend: adSpend,
        metaAdSpendChange: 0,
        googleAdSpend: 0,
        googleAdSpendChange: 0,
        contributionMargin,
        contributionMarginChange: 0,
        contributionMarginPercentage:
          revenue > 0 ? (contributionMargin / revenue) * 100 : 0,
        contributionMarginPercentageChange: 0,
        metaROAS: roas,
        metaROASChange: 0,
        googleROAS: 0,
        googleROASChange: 0,
        metaSpendPercentage: adSpend > 0 ? 100 : 0, // Only 100% if there's actual Meta spend
        metaSpendPercentageChange: 0,
        googleSpendPercentage: 0,
        googleSpendPercentageChange: 0,
        unitsSold: filteredOrders.reduce(
          (sum, o) => sum + (o.totalQuantity || 0),
          0,
        ),
        unitsSoldChange: 0,
        newCustomers,
        newCustomersChange: 0,
        returningCustomers,
        returningCustomersChange: 0,
        repeatCustomerRate,
        repeatCustomerRateChange: 0,
        returnRate,
        returnRateChange: 0,
        calendarMoMRevenueGrowth,
        period: {
          start: startDateStr,
          end: endDateStr,
        },
      };
    }

    // Aggregate previous period metrics
    type SummaryAcc = {
      revenue: number;
      profit: number;
      orders: number;
      customers: number;
      products: number;
      adSpend: number;
      grossSales: number;
      grossProfit: number;
      discounts: number;
      cogs: number;
      shippingCosts: number;
      handlingFees: number;
      customCosts: number;
      transactionFees: number;
      taxesCollected: number;
      metaAdSpend: number;
      googleAdSpend: number;
      contributionMargin: number;
      unitsSold: number;
      newCustomers: number;
      returningCustomers: number;
      returns: number;
    };
    const createSummaryAcc = (): SummaryAcc => ({
      revenue: 0,
      profit: 0,
      orders: 0,
      customers: 0,
      products: 0,
      adSpend: 0,
      grossSales: 0,
      grossProfit: 0,
      discounts: 0,
      cogs: 0,
      shippingCosts: 0,
      handlingFees: 0,
      customCosts: 0,
      transactionFees: 0,
      taxesCollected: 0,
      metaAdSpend: 0,
      googleAdSpend: 0,
      contributionMargin: 0,
      unitsSold: 0,
      newCustomers: 0,
      returningCustomers: 0,
      returns: 0,
    });

    const previousSummary = previousMetrics.reduce<SummaryAcc>(
      (acc, m: Doc<"metricsDaily">) => {
        acc.revenue += m.revenue || 0;
        acc.profit += m.netProfit || 0;
        acc.orders += m.orders || 0;
        acc.customers += m.totalCustomers || 0;
        acc.products += 0;
        acc.adSpend += m.totalAdSpend;
        acc.grossSales += m.grossSales || 0;
        acc.grossProfit += m.grossProfit || 0;
        acc.discounts += m.discounts || 0;
        acc.cogs += m.cogs || 0;
        acc.shippingCosts += m.shippingCosts || 0;
        acc.transactionFees += m.transactionFees || 0;
        acc.handlingFees += m.handlingFees || 0;
        acc.customCosts += m.customCosts || 0;
        acc.taxesCollected += m.taxesCollected || 0;
        acc.metaAdSpend += m.metaAdSpend || 0;
        acc.googleAdSpend += m.googleAdSpend || 0;
        acc.contributionMargin += m.contributionMargin || 0;
        acc.unitsSold += m.unitsSold || 0;
        acc.newCustomers += m.newCustomers || 0;
        acc.returningCustomers += m.returningCustomers || 0;
        acc.returns += m.returns || 0;

        return acc;
      },
      createSummaryAcc(),
    );

    // Helper function to calculate percentage change
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;

      return ((current - previous) / previous) * 100;
    };

    // Aggregate current metrics - include all metrics from metricsDaily
    const summary = metrics.reduce<SummaryAcc>(
      (acc, m: Doc<"metricsDaily">) => {
        acc.revenue += m.revenue || 0;
        acc.profit += m.netProfit || 0;
        acc.orders += m.orders || 0;
        acc.customers += m.totalCustomers || 0;
        acc.products += 0; // products field doesn't exist
        acc.adSpend += m.totalAdSpend;

        // Additional metrics for comprehensive dashboard
        acc.grossSales += m.grossSales || 0;
        acc.grossProfit += m.grossProfit || 0;
        acc.discounts += m.discounts || 0;
        acc.cogs += m.cogs || 0;
        acc.shippingCosts += m.shippingCosts || 0;
        acc.transactionFees += m.transactionFees || 0;
        acc.handlingFees += m.handlingFees || 0;
        acc.customCosts += m.customCosts || 0;
        acc.taxesCollected += m.taxesCollected || 0;
        acc.metaAdSpend += m.metaAdSpend || 0;
        acc.googleAdSpend += m.googleAdSpend || 0;
        acc.contributionMargin += m.contributionMargin || 0;
        acc.unitsSold += m.unitsSold || 0;
        acc.newCustomers += m.newCustomers || 0;
        acc.returningCustomers += m.returningCustomers || 0;
        acc.returns += m.returns || 0;

        return acc;
      },
      createSummaryAcc(),
    );

    // production: avoid noisy dashboard logs

    // Calculate current derived metrics
    const profitMargin =
      summary.revenue > 0 ? (summary.profit / summary.revenue) * 100 : 0;
    const avgOrderValue =
      summary.orders > 0 ? summary.revenue / summary.orders : 0;
    const roas = summary.adSpend > 0 ? summary.revenue / summary.adSpend : 0;
    const poas = summary.adSpend > 0 ? summary.profit / summary.adSpend : 0;
    const avgOrderProfit =
      summary.orders > 0 ? summary.profit / summary.orders : 0;
    const avgOrderCost =
      summary.orders > 0
        ? (summary.revenue - summary.profit) / summary.orders
        : 0;
    const adSpendPerOrder =
      summary.orders > 0 ? summary.adSpend / summary.orders : 0;

    // Additional calculated metrics
    const grossProfitMargin =
      summary.grossSales > 0
        ? (summary.grossProfit / summary.grossSales) * 100
        : 0;
    const discountRate =
      summary.grossSales > 0
        ? (summary.discounts / summary.grossSales) * 100
        : 0;
    const contributionMarginPercentage =
      summary.revenue > 0
        ? (summary.contributionMargin / summary.revenue) * 100
        : 0;
    const metaROAS =
      summary.metaAdSpend > 0 ? summary.revenue / summary.metaAdSpend : 0;
    const googleROAS =
      summary.googleAdSpend > 0 ? summary.revenue / summary.googleAdSpend : 0;
    const metaSpendPercentage =
      summary.adSpend > 0 ? (summary.metaAdSpend / summary.adSpend) * 100 : 0;
    const googleSpendPercentage =
      summary.adSpend > 0 ? (summary.googleAdSpend / summary.adSpend) * 100 : 0;
    const ncROAS =
      summary.newCustomers > 0 && summary.adSpend > 0 && summary.orders > 0
        ? (avgOrderValue * summary.newCustomers) / summary.adSpend
        : 0;
    const returnRate =
      summary.orders > 0 ? (summary.returns / summary.orders) * 100 : 0;
    const repeatCustomerRate =
      summary.customers > 0
        ? (summary.returningCustomers / summary.customers) * 100
        : 0;
    const customerAcquisitionCost =
      summary.newCustomers > 0
        ? summary.adSpend / summary.newCustomers
        : 0;

    // Calculate previous period derived metrics
    const prevProfitMargin =
      previousSummary.revenue > 0
        ? (previousSummary.profit / previousSummary.revenue) * 100
        : 0;
    const prevAvgOrderValue =
      previousSummary.orders > 0
        ? previousSummary.revenue / previousSummary.orders
        : 0;
    const prevRoas =
      previousSummary.adSpend > 0
        ? previousSummary.revenue / previousSummary.adSpend
        : 0;
    const prevPoas =
      previousSummary.adSpend > 0
        ? previousSummary.profit / previousSummary.adSpend
        : 0;
    const prevAvgOrderProfit =
      previousSummary.orders > 0
        ? previousSummary.profit / previousSummary.orders
        : 0;
    const prevAvgOrderCost =
      previousSummary.orders > 0
        ? (previousSummary.revenue - previousSummary.profit) /
          previousSummary.orders
        : 0;
    const prevAdSpendPerOrder =
      previousSummary.orders > 0
        ? previousSummary.adSpend / previousSummary.orders
        : 0;
    const prevGrossProfitMargin =
      previousSummary.grossSales > 0
        ? (previousSummary.grossProfit / previousSummary.grossSales) * 100
        : 0;
    const prevDiscountRate =
      previousSummary.grossSales > 0
        ? (previousSummary.discounts / previousSummary.grossSales) * 100
        : 0;
    const prevContributionMarginPercentage =
      previousSummary.revenue > 0
        ? (previousSummary.contributionMargin / previousSummary.revenue) * 100
        : 0;
    const prevMetaROAS =
      previousSummary.metaAdSpend > 0
        ? previousSummary.revenue / previousSummary.metaAdSpend
        : 0;
    const prevGoogleROAS =
      previousSummary.googleAdSpend > 0
        ? previousSummary.revenue / previousSummary.googleAdSpend
        : 0;
    const prevMetaSpendPercentage =
      previousSummary.adSpend > 0
        ? (previousSummary.metaAdSpend / previousSummary.adSpend) * 100
        : 0;
    const prevGoogleSpendPercentage =
      previousSummary.adSpend > 0
        ? (previousSummary.googleAdSpend / previousSummary.adSpend) * 100
        : 0;
    const prevNcROAS =
      previousSummary.newCustomers > 0 &&
      previousSummary.adSpend > 0 &&
      previousSummary.orders > 0
        ? (prevAvgOrderValue * previousSummary.newCustomers) /
          previousSummary.adSpend
        : 0;
    const prevReturnRate =
      previousSummary.orders > 0
        ? (previousSummary.returns / previousSummary.orders) * 100
        : 0;
    const prevRepeatCustomerRate =
      previousSummary.customers > 0
        ? (previousSummary.returningCustomers / previousSummary.customers) * 100
        : 0;
    const prevCustomerAcquisitionCost =
      previousSummary.newCustomers > 0
        ? previousSummary.adSpend / previousSummary.newCustomers
        : 0;

    // Compute strict calendar MoM revenue growth using endDateStr's month
    const end = new Date(endDateStr);
    const currentMonthStart = new Date(end.getFullYear(), end.getMonth(), 1)
      .toISOString()
      .substring(0, 10);
    const currentMonthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0)
      .toISOString()
      .substring(0, 10);
    const previousMonthStart = new Date(end.getFullYear(), end.getMonth() - 1, 1)
      .toISOString()
      .substring(0, 10);
    const previousMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0)
      .toISOString()
      .substring(0, 10);

    const currentMonthRevenue = allOrgMetrics
      .filter((m) => m.date >= currentMonthStart && m.date <= currentMonthEnd)
      .reduce((sum, m) => sum + (m.revenue || 0), 0);
    const previousMonthRevenue = allOrgMetrics
      .filter((m) => m.date >= previousMonthStart && m.date <= previousMonthEnd)
      .reduce((sum, m) => sum + (m.revenue || 0), 0);
    const calendarMoMRevenueGrowth =
      previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) *
          100
        : 0;

    return {
      ...summary,
      // Add change percentages for all metrics
      revenueChange: calculateChange(summary.revenue, previousSummary.revenue),
      profitChange: calculateChange(summary.profit, previousSummary.profit),
      ordersChange: calculateChange(summary.orders, previousSummary.orders),
      customersChange: calculateChange(
        summary.customers,
        previousSummary.customers,
      ),
      productsChange: 0, // Products don't typically have period comparison
      adSpendChange: calculateChange(summary.adSpend, previousSummary.adSpend),

      profitMargin,
      profitMarginChange: calculateChange(profitMargin, prevProfitMargin),
      avgOrderValue,
      avgOrderValueChange: calculateChange(avgOrderValue, prevAvgOrderValue),
      roas,
      roasChange: calculateChange(roas, prevRoas),
      poas,
      poasChange: calculateChange(poas, prevPoas),
      ncROAS,
      ncROASChange: calculateChange(ncROAS, prevNcROAS),
      adSpendPerOrder,
      adSpendPerOrderChange: calculateChange(
        adSpendPerOrder,
        prevAdSpendPerOrder,
      ),
      avgOrderProfit,
      avgOrderProfitChange: calculateChange(
        avgOrderProfit,
        prevAvgOrderProfit,
      ),
      avgOrderCost,
      avgOrderCostChange: calculateChange(avgOrderCost, prevAvgOrderCost),
      customerAcquisitionCost,
      customerAcquisitionCostChange: calculateChange(
        customerAcquisitionCost,
        prevCustomerAcquisitionCost,
      ),

      grossSalesChange: calculateChange(
        summary.grossSales,
        previousSummary.grossSales,
      ),
      grossProfitChange: calculateChange(
        summary.grossProfit,
        previousSummary.grossProfit,
      ),
      grossProfitMargin,
      grossProfitMarginChange: calculateChange(
        grossProfitMargin,
        prevGrossProfitMargin,
      ),
      discountsChange: calculateChange(
        summary.discounts,
        previousSummary.discounts,
      ),
      discountRate,
      discountRateChange: calculateChange(discountRate, prevDiscountRate),
      cogsChange: calculateChange(summary.cogs, previousSummary.cogs),
      shippingCostsChange: calculateChange(
        summary.shippingCosts,
        previousSummary.shippingCosts,
      ),
      handlingFeesChange: calculateChange(
        summary.handlingFees,
        previousSummary.handlingFees,
      ),
      customCostsChange: calculateChange(
        summary.customCosts,
        previousSummary.customCosts,
      ),
      transactionFeesChange: calculateChange(
        summary.transactionFees,
        previousSummary.transactionFees,
      ),
      taxesCollectedChange: calculateChange(
        summary.taxesCollected,
        previousSummary.taxesCollected,
      ),

      contributionMarginChange: calculateChange(
        summary.contributionMargin,
        previousSummary.contributionMargin,
      ),
      contributionMarginPercentage,
      contributionMarginPercentageChange: calculateChange(
        contributionMarginPercentage,
        prevContributionMarginPercentage,
      ),

      metaAdSpendChange: calculateChange(
        summary.metaAdSpend,
        previousSummary.metaAdSpend,
      ),
      googleAdSpendChange: calculateChange(
        summary.googleAdSpend,
        previousSummary.googleAdSpend,
      ),
      metaROAS,
      metaROASChange: calculateChange(metaROAS, prevMetaROAS),
      googleROAS,
      googleROASChange: calculateChange(googleROAS, prevGoogleROAS),
      metaSpendPercentage,
      metaSpendPercentageChange: calculateChange(
        metaSpendPercentage,
        prevMetaSpendPercentage,
      ),
      googleSpendPercentage,
      googleSpendPercentageChange: calculateChange(
        googleSpendPercentage,
        prevGoogleSpendPercentage,
      ),

      unitsSoldChange: calculateChange(
        summary.unitsSold,
        previousSummary.unitsSold,
      ),
      newCustomersChange: calculateChange(
        summary.newCustomers,
        previousSummary.newCustomers,
      ),
      returningCustomersChange: calculateChange(
        summary.returningCustomers,
        previousSummary.returningCustomers,
      ),
      repeatCustomerRate,
      repeatCustomerRateChange: calculateChange(
        repeatCustomerRate,
        prevRepeatCustomerRate,
      ),
      returnRate,
      returnRateChange: calculateChange(returnRate, prevReturnRate),
      calendarMoMRevenueGrowth,

      period: {
        start: startDateStr,
        end: endDateStr,
      },
    };
  },
});

/**
 * Get trending products
 */
export const getTrendingProducts = query({
  args: {
    limit: v.optional(v.number()),
    timeRange: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      productId: v.string(),
      productName: v.string(),
      productImage: v.string(),
      revenue: v.number(),
      unitsSold: v.number(),
      orders: v.number(),
      growth: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const organizationId = auth.orgId;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (args.timeRange || "7d") {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    // Get product metrics for date range
    const productMetrics = await ctx.db
      .query("productMetrics")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect()
      .then((metrics) => {
        const startStr = startDate.toISOString().substring(0, 10);
        const endStr = endDate.toISOString().substring(0, 10);
        return metrics.filter((m) => m.date >= startStr && m.date <= endStr);
      });

    // Aggregate by product
    const productMap = new Map();

    productMetrics.forEach((metric) => {
      const existing = productMap.get(metric.productId) || {
        productId: metric.productId,
        productName: "", // productName field doesn't exist in schema
        productImage: "", // productImage field doesn't exist in schema
        revenue: 0,
        unitsSold: 0,
        orders: 0,
        growth: 0,
      };

      existing.revenue += metric.revenue || 0;
      existing.unitsSold += metric.unitsSold || 0;
      existing.orders += metric.orders || 0;

      productMap.set(metric.productId, existing);
    });

    // Sort by revenue and limit
    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, args.limit || 10);
  },
});

/**
 * Get recent activity
 */
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
    type: v.optional(v.string()), // "orders", "syncs", "all"
  },
  returns: v.array(
    v.object({
      type: v.string(),
      title: v.string(),
      description: v.string(),
      amount: v.optional(v.number()),
      timestamp: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const orgId = auth.orgId as Id<"organizations">;

    const activities: Array<{
      type: string;
      title: string;
      description: string;
      amount?: number;
      timestamp: number;
    }> = [];
    const limit = args.limit || 20;
    const type = args.type || "all";

    // Get recent orders
    if (type === "orders" || type === "all") {
      const orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .take(limit);

      orders.forEach((order) => {
        activities.push({
          type: "order",
          title: `New order #${order.orderNumber}`,
          description: order.email || "Customer",
          amount: order.totalPrice,
          timestamp: order.shopifyCreatedAt,
        });
      });
    }

    // Get recent syncs
    if (type === "syncs" || type === "all") {
      const syncs = await ctx.db
        .query("syncSessions")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .take(limit);

      syncs.forEach((sync) => {
        activities.push({
          type: "sync",
          title: `${sync.platform} sync ${sync.status}`,
          description: `${sync.recordsProcessed || 0} records processed`,
          timestamp: sync.startedAt,
        });
      });
    }

    // Sort by timestamp and limit
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },
});

/**
 * Get performance indicators
 */
export const getPerformanceIndicators = query({
  args: {},
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        name: v.string(),
        value: v.number(),
        change: v.number(),
        trend: v.string(),
      }),
    ),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const organizationId = auth.orgId;

    // Get today's and yesterday's metrics
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Get metrics for today and yesterday
    const allMetrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    const todayMetrics = allMetrics.find((m) => m.date === today);
    const yesterdayMetrics = allMetrics.find((m) => m.date === yesterday);

    // Calculate indicators
    const indicators: Array<{
      name: string;
      value: number;
      change: number;
      trend: string;
    }> = [];

    if (todayMetrics && yesterdayMetrics) {
      // Revenue indicator
      indicators.push({
        name: "Revenue",
        value: todayMetrics.revenue || 0,
        change:
          yesterdayMetrics.revenue > 0
            ? ((todayMetrics.revenue - yesterdayMetrics.revenue) /
                yesterdayMetrics.revenue) *
              100
            : 0,
        trend: todayMetrics.revenue >= yesterdayMetrics.revenue ? "up" : "down",
      });

      // Orders indicator
      indicators.push({
        name: "Orders",
        value: todayMetrics.orders || 0,
        change:
          yesterdayMetrics.orders > 0
            ? ((todayMetrics.orders - yesterdayMetrics.orders) /
                yesterdayMetrics.orders) *
              100
            : 0,
        trend: todayMetrics.orders >= yesterdayMetrics.orders ? "up" : "down",
      });

      // Conversion rate indicator
      // visitors field doesn't exist, skip conversion rate
      const todayConversion = 0;
      const yesterdayConversion = 0;

      indicators.push({
        name: "Conversion Rate",
        value: todayConversion,
        change: todayConversion - yesterdayConversion,
        trend: todayConversion >= yesterdayConversion ? "up" : "down",
      });

      // Average order value indicator
      const todayAOV =
        todayMetrics.orders > 0
          ? todayMetrics.revenue / todayMetrics.orders
          : 0;
      const yesterdayAOV =
        yesterdayMetrics.orders > 0
          ? yesterdayMetrics.revenue / yesterdayMetrics.orders
          : 0;

      indicators.push({
        name: "Average Order Value",
        value: todayAOV,
        change: todayAOV - yesterdayAOV,
        trend: todayAOV >= yesterdayAOV ? "up" : "down",
      });

      // Profit indicator
      indicators.push({
        name: "Profit",
        value: todayMetrics.netProfit || 0,
        change:
          yesterdayMetrics.netProfit > 0
            ? ((todayMetrics.netProfit - yesterdayMetrics.netProfit) /
                yesterdayMetrics.netProfit) *
              100
            : 0,
        trend:
          todayMetrics.netProfit >= yesterdayMetrics.netProfit ? "up" : "down",
      });

      // ROAS indicator
      const todayROAS =
        todayMetrics.totalAdSpend > 0
          ? todayMetrics.revenue / todayMetrics.totalAdSpend
          : 0;
      const yesterdayROAS =
        yesterdayMetrics.totalAdSpend > 0
          ? yesterdayMetrics.revenue / yesterdayMetrics.totalAdSpend
          : 0;

      indicators.push({
        name: "ROAS",
        value: todayROAS,
        change: todayROAS - yesterdayROAS,
        trend: todayROAS >= yesterdayROAS ? "up" : "down",
      });
    }

    return indicators;
  },
});

/**
 * Get trending metrics
 */
export const getTrendingMetrics = query({
  args: {
    metric: v.optional(
      v.union(
        v.literal("revenue"),
        v.literal("orders"),
        v.literal("customers"),
        v.literal("profit"),
      ),
    ),
    timeframe: v.optional(
      v.union(v.literal("24h"), v.literal("7d"), v.literal("30d")),
    ),
    comparison: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const organizationId = auth.orgId;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    const previousStartDate = new Date();
    const previousEndDate = new Date();

    // Use preset time ranges
    switch (args.timeframe || "7d") {
      case "24h":
        startDate.setHours(startDate.getHours() - 24);
        previousStartDate.setHours(previousStartDate.getHours() - 48);
        previousEndDate.setHours(previousEndDate.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        previousStartDate.setDate(previousStartDate.getDate() - 14);
        previousEndDate.setDate(previousEndDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        previousStartDate.setDate(previousStartDate.getDate() - 60);
        previousEndDate.setDate(previousEndDate.getDate() - 30);
        break;
    }

    // Get metrics for current and previous periods
    const [currentMetrics, previousMetrics] = await Promise.all([
      ctx.db
        .query("metricsDaily")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect()
        .then((metrics) =>
          metrics.filter(
            (m) => new Date(m.date) >= startDate && new Date(m.date) <= endDate,
          ),
        ),
      ctx.db
        .query("metricsDaily")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect()
        .then((metrics) =>
          metrics.filter(
            (m) =>
              new Date(m.date) >= previousStartDate &&
              new Date(m.date) <= previousEndDate,
          ),
        ),
    ]);

    // Calculate values based on metric type
    const metricType = args.metric || "revenue";

    const getMetricValue = (metrics: typeof currentMetrics, metric: string) => {
      return metrics.reduce((sum, m) => {
        switch (metric) {
          case "revenue":
            return sum + (m.revenue || 0);
          case "orders":
            return sum + (m.orders || 0);
          case "customers":
            return sum + (m.totalCustomers || 0);
          case "profit":
            return sum + (m.netProfit || 0);
          default:
            return sum;
        }
      }, 0);
    };

    const currentValue = getMetricValue(currentMetrics, metricType);
    const previousValue = getMetricValue(previousMetrics, metricType);

    // Calculate change
    const change = currentValue - previousValue;
    const changePercent =
      previousValue > 0 ? (change / previousValue) * 100 : 0;
    const direction = change > 0 ? "up" : change < 0 ? "down" : "neutral";

    // Prepare chart data if requested
    let chartData: { date: string; value: number; comparison?: number }[] | undefined;

    if (args.comparison) {
      chartData = currentMetrics.map((m) => ({
        date: m.date,
        value:
          metricType === "revenue"
            ? m.revenue
            : metricType === "orders"
              ? m.orders
              : metricType === "customers"
                ? m.totalCustomers
                : metricType === "profit"
                  ? m.netProfit
                  : 0,
      }));
    }

    return {
      value: currentValue,
      change,
      changePercent,
      direction,
      chartData,
    };
  },
});

/**
 * Get activity feed (alias for getRecentActivity)
 */
export const getActivityFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      type: v.string(),
      title: v.string(),
      description: v.string(),
      amount: v.optional(v.number()),
      timestamp: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const organizationId = auth.orgId;

    // Get recent sync sessions as activity
    const syncSessions = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .take(args.limit || 10);

    return syncSessions.map((session) => ({
      type: session.platform,
      title: `${session.platform} sync ${session.status}`,
      description: `Synced ${session.recordsProcessed || 0} records`,
      amount: session.recordsProcessed,
      timestamp: session.startedAt,
    }));
  },
});

/**
 * Get sync status
 */
export const getSyncStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        platform: v.string(),
        status: v.string(),
        lastSync: v.union(v.null(), v.number()),
        recordsProcessed: v.number(),
        nextSync: v.union(v.null(), v.number()),
      }),
    ),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const organizationId = auth.orgId;

    // Get latest sync sessions for each platform
    const platforms = ["shopify", "meta"];
    const syncStatuses = [];

    for (const platform of platforms as ("shopify" | "meta")[]) {
      const latestSync = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("platform", platform),
        )
        .order("desc")
        .first();

      if (latestSync) {
        syncStatuses.push({
          platform,
          status: latestSync.status,
          lastSync: latestSync.completedAt || latestSync.startedAt,
          recordsProcessed: latestSync.recordsProcessed || 0,
          nextSync: calculateNextSync(latestSync),
        });
      } else {
        // Check if platform is connected
        const isConnected = await isPlatformConnected(
          ctx,
          organizationId,
          platform,
        );

        syncStatuses.push({
          platform,
          status: isConnected ? "pending" : "not_connected",
          lastSync: null,
          recordsProcessed: 0,
          nextSync: null,
        });
      }
    }

    return syncStatuses;
  },
});

// Helper functions
function calculateNextSync(lastSync: { completedAt?: number }): number | null {
  if (!lastSync.completedAt) return null;

  // Default to 1 hour from last sync
  return lastSync.completedAt + 60 * 60 * 1000;
}

async function isPlatformConnected(
  ctx: GenericQueryCtx<DataModel>,
  organizationId: Id<"organizations">,
  platform: "shopify" | "meta",
): Promise<boolean> {
  if (platform === "shopify") {
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q.eq("organizationId", organizationId).eq("isActive", true),
      )
      .first();

    return !!store;
  }

  const session = await ctx.db
    .query("integrationSessions")
    .withIndex("by_org_platform_and_status", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("platform", platform)
        .eq("isActive", true),
    )
    .first();

  return !!session;
}
