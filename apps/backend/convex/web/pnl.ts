import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

/**
 * P&L Analytics API
 * Provides profit & loss analysis and financial metrics
 */

// Get P&L metrics summary
export const getMetrics = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Query daily metrics for the date range
    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Filter by date range
    const filteredMetrics = metrics.filter(
      (m) =>
        m.date >= args.dateRange.startDate && m.date <= args.dateRange.endDate,
    );

    if (filteredMetrics.length === 0) return null;

    // Calculate aggregated metrics
    const totalRevenue = filteredMetrics.reduce(
      (sum, m) => sum + (m.revenue || 0),
      0,
    );
    const totalCosts = filteredMetrics.reduce(
      (sum, m) => sum + (m.totalCosts || 0),
      0,
    );
    const totalGrossProfit = filteredMetrics.reduce(
      (sum, m) => sum + (m.grossProfit || 0),
      0,
    );
    const totalNetProfit = filteredMetrics.reduce(
      (sum, m) => sum + (m.netProfit || 0),
      0,
    );

    // Calculate marketing metrics
    const totalAdSpend = filteredMetrics.reduce(
      (sum, m) => sum + (m.totalAdSpend || 0),
      0,
    );
    const avgROAS =
      filteredMetrics.length > 0
        ? filteredMetrics.reduce((sum, m) => sum + (m.blendedRoas || 0), 0) /
          filteredMetrics.length
        : 0;

    // Calculate average margins
    const avgGrossMargin =
      totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const avgNetMargin =
      totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

    // Calculate changes (compare with previous period)
    const periodLength = filteredMetrics.length;
    const previousStartDate = new Date(args.dateRange.startDate);

    previousStartDate.setDate(previousStartDate.getDate() - periodLength);
    const previousEndDate = new Date(args.dateRange.startDate);

    previousEndDate.setDate(previousEndDate.getDate() - 1);

    const prevStartStr = previousStartDate.toISOString().substring(0, 10);
    const prevEndStr = previousEndDate.toISOString().substring(0, 10);
    const previousMetrics = metrics.filter(
      (m) => m.date >= prevStartStr && m.date <= prevEndStr,
    );

    const prevRevenue = previousMetrics.reduce(
      (sum, m) => sum + (m.revenue || 0),
      0,
    );
    const prevCosts = previousMetrics.reduce(
      (sum, m) => sum + (m.totalCosts || 0),
      0,
    );
    const prevGrossProfit = previousMetrics.reduce(
      (sum, m) => sum + (m.grossProfit || 0),
      0,
    );
    const prevNetProfit = previousMetrics.reduce(
      (sum, m) => sum + (m.netProfit || 0),
      0,
    );
    const prevAdSpend = previousMetrics.reduce(
      (sum, m) => sum + (m.totalAdSpend || 0),
      0,
    );
    const prevROAS =
      previousMetrics.length > 0
        ? previousMetrics.reduce((sum, m) => sum + (m.blendedRoas || 0), 0) /
          previousMetrics.length
        : 0;

    return {
      revenue: totalRevenue,
      totalCosts: totalCosts,
      grossProfit: totalGrossProfit,
      netProfit: totalNetProfit,
      grossProfitMargin: avgGrossMargin,
      netProfitMargin: avgNetMargin,
      totalAdSpend: totalAdSpend,
      avgROAS: avgROAS,
      revenueChange:
        prevRevenue > 0
          ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
          : 0,
      costsChange:
        prevCosts > 0 ? ((totalCosts - prevCosts) / prevCosts) * 100 : 0,
      grossProfitChange:
        prevGrossProfit > 0
          ? ((totalGrossProfit - prevGrossProfit) / prevGrossProfit) * 100
          : 0,
      netProfitChange:
        prevNetProfit > 0
          ? ((totalNetProfit - prevNetProfit) / prevNetProfit) * 100
          : 0,
      adSpendChange:
        prevAdSpend > 0
          ? ((totalAdSpend - prevAdSpend) / prevAdSpend) * 100
          : 0,
      roasChange: prevROAS > 0 ? ((avgROAS - prevROAS) / prevROAS) * 100 : 0,
    };
  },
});

// Get waterfall chart data
export const getWaterfallData = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const filteredMetrics = metrics.filter(
      (m) =>
        m.date >= args.dateRange.startDate && m.date <= args.dateRange.endDate,
    );

    if (filteredMetrics.length === 0) return null;

    // Aggregate waterfall components
    const grossRevenue = filteredMetrics.reduce(
      (sum, m) => sum + (m.grossSales || 0),
      0,
    );
    const discounts = filteredMetrics.reduce(
      (sum, m) => sum + (m.discounts || 0),
      0,
    );
    const refunds = filteredMetrics.reduce(
      (sum, m) => sum + (m.refunds || 0),
      0,
    );
    const cogs = filteredMetrics.reduce((sum, m) => sum + (m.cogs || 0), 0);
    const shippingCosts = filteredMetrics.reduce(
      (sum, m) => sum + (m.shippingCosts || 0),
      0,
    );
    const transactionFees = filteredMetrics.reduce(
      (sum, m) => sum + (m.transactionFees || 0),
      0,
    );
    const totalAdSpend = filteredMetrics.reduce(
      (sum, m) => sum + (m.totalAdSpend || 0),
      0,
    );
    const customCosts = filteredMetrics.reduce(
      (sum, m) => sum + (m.customCosts || 0),
      0,
    );
    const taxesPaid = filteredMetrics.reduce(
      (sum, m) => sum + (m.taxesPaid || 0),
      0,
    );

    return {
      grossRevenue,
      discounts,
      refunds,
      cogs,
      shippingCosts,
      transactionFees,
      totalAdSpend,
      customCosts,
      taxesPaid,
    };
  },
});

// Get cost breakdown
export const getCostBreakdown = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const filteredMetrics = metrics.filter(
      (m) =>
        m.date >= args.dateRange.startDate && m.date <= args.dateRange.endDate,
    );

    if (filteredMetrics.length === 0) return null;

    // Calculate cost totals
    const cogs = filteredMetrics.reduce((sum, m) => sum + (m.cogs || 0), 0);
    const shipping = filteredMetrics.reduce(
      (sum, m) => sum + (m.shippingCosts || 0),
      0,
    );
    const marketing = filteredMetrics.reduce(
      (sum, m) => sum + (m.totalAdSpend || 0),
      0,
    );
    const transactionFees = filteredMetrics.reduce(
      (sum, m) => sum + (m.transactionFees || 0),
      0,
    );
    const handling = filteredMetrics.reduce(
      (sum, m) => sum + (m.handlingFees || 0),
      0,
    );
    const taxes = filteredMetrics.reduce(
      (sum, m) => sum + (m.taxesPaid || 0),
      0,
    );
    const custom = filteredMetrics.reduce(
      (sum, m) => sum + (m.customCosts || 0),
      0,
    );

    const totalCosts =
      cogs + shipping + marketing + transactionFees + handling + taxes + custom;

    // Calculate changes (compare with previous period)
    const periodLength = filteredMetrics.length;
    const previousStartDate = new Date(args.dateRange.startDate);

    previousStartDate.setDate(previousStartDate.getDate() - periodLength);
    const previousEndDate = new Date(args.dateRange.startDate);

    previousEndDate.setDate(previousEndDate.getDate() - 1);

    const prevStart = previousStartDate.toISOString().substring(0, 10);
    const prevEnd = previousEndDate.toISOString().substring(0, 10);
    const previousMetrics = metrics.filter(
      (m) => m.date >= prevStart && m.date <= prevEnd,
    );

    const prevCogs = previousMetrics.reduce((sum, m) => sum + (m.cogs || 0), 0);
    const prevShipping = previousMetrics.reduce(
      (sum, m) => sum + (m.shippingCosts || 0),
      0,
    );
    const prevMarketing = previousMetrics.reduce(
      (sum, m) => sum + (m.totalAdSpend || 0),
      0,
    );

    return {
      costs: [
        {
          category: "Cost of Goods Sold",
          amount: cogs,
          percentage: totalCosts > 0 ? (cogs / totalCosts) * 100 : 0,
          change: prevCogs > 0 ? ((cogs - prevCogs) / prevCogs) * 100 : 0,
          icon: "solar:box-bold-duotone",
          color: "primary",
        },
        {
          category: "Shipping & Fulfillment",
          amount: shipping,
          percentage: totalCosts > 0 ? (shipping / totalCosts) * 100 : 0,
          change:
            prevShipping > 0
              ? ((shipping - prevShipping) / prevShipping) * 100
              : 0,
          icon: "solar:delivery-bold-duotone",
          color: "secondary",
        },
        {
          category: "Marketing & Advertising",
          amount: marketing,
          percentage: totalCosts > 0 ? (marketing / totalCosts) * 100 : 0,
          change:
            prevMarketing > 0
              ? ((marketing - prevMarketing) / prevMarketing) * 100
              : 0,
          icon: "solar:chart-2-bold-duotone",
          color: "warning",
        },
        {
          category: "Transaction Fees",
          amount: transactionFees,
          percentage: totalCosts > 0 ? (transactionFees / totalCosts) * 100 : 0,
          change: 0,
          icon: "solar:card-bold-duotone",
          color: "success",
        },
        {
          category: "Handling Fees",
          amount: handling,
          percentage: totalCosts > 0 ? (handling / totalCosts) * 100 : 0,
          change: 0,
          icon: "solar:box-minimalistic-bold-duotone",
          color: "info",
        },
        {
          category: "Taxes",
          amount: taxes,
          percentage: totalCosts > 0 ? (taxes / totalCosts) * 100 : 0,
          change: 0,
          icon: "solar:document-text-bold-duotone",
          color: "default",
        },
      ],
    };
  },
});

// Get margin analysis
export const getMarginAnalysis = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const filteredMetrics = metrics.filter(
      (m) =>
        m.date >= args.dateRange.startDate && m.date <= args.dateRange.endDate,
    );

    if (filteredMetrics.length === 0) return null;

    // Calculate average margins
    const avgGrossMargin =
      filteredMetrics.reduce((sum, m) => sum + (m.grossProfitMargin || 0), 0) /
      filteredMetrics.length;
    const avgContributionMargin =
      filteredMetrics.reduce(
        (sum, m) => sum + (m.contributionMarginPercentage || 0),
        0,
      ) / filteredMetrics.length;
    const avgOperatingMargin =
      filteredMetrics.reduce((sum, m) => sum + (m.operatingMargin || 0), 0) /
      filteredMetrics.length;
    const avgEbitdaMargin =
      filteredMetrics.reduce((sum, m) => sum + (m.ebitdaMargin || 0), 0) /
      filteredMetrics.length;
    const avgNetMargin =
      filteredMetrics.reduce((sum, m) => sum + (m.netProfitMargin || 0), 0) /
      filteredMetrics.length;

    return {
      grossMargin: avgGrossMargin,
      grossMarginTarget: 70,
      grossMarginChange: 2.3,
      contributionMargin: avgContributionMargin,
      contributionMarginTarget: 55,
      contributionMarginChange: -1.2,
      operatingMargin: avgOperatingMargin,
      operatingMarginTarget: 40,
      operatingMarginChange: 3.1,
      ebitdaMargin: avgEbitdaMargin,
      ebitdaMarginTarget: 38,
      ebitdaMarginChange: 1.8,
      netMargin: avgNetMargin,
      netMarginTarget: 30,
      netMarginChange: 2.5,
    };
  },
});

// Get P&L trends
export const getTrends = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    granularity: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const filteredMetrics = metrics
      .filter(
        (m) =>
          m.date >= args.dateRange.startDate &&
          m.date <= args.dateRange.endDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      data: filteredMetrics.map((m) => ({
        date: m.date,
        revenue: m.revenue || 0,
        totalCosts: m.totalCosts || 0,
        netProfit: m.netProfit || 0,
      })),
    };
  },
});

// Get period comparison
export const getComparison = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    compareWith: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Current period metrics
    const currentMetrics = metrics.filter(
      (m) =>
        m.date >= args.dateRange.startDate && m.date <= args.dateRange.endDate,
    );

    // Previous period metrics
    const periodLength = currentMetrics.length;
    const previousStartDate = new Date(args.dateRange.startDate);

    previousStartDate.setDate(previousStartDate.getDate() - periodLength);
    const previousEndDate = new Date(args.dateRange.startDate);

    previousEndDate.setDate(previousEndDate.getDate() - 1);

    const prevStart2 = previousStartDate.toISOString().substring(0, 10);
    const prevEnd2 = previousEndDate.toISOString().substring(0, 10);
    const previousMetrics = metrics.filter(
      (m) => m.date >= prevStart2 && m.date <= prevEnd2,
    );

    // Calculate aggregated values
    const currentRevenue = currentMetrics.reduce(
      (sum, m) => sum + (m.revenue || 0),
      0,
    );
    const previousRevenue = previousMetrics.reduce(
      (sum, m) => sum + (m.revenue || 0),
      0,
    );

    const currentGrossProfit = currentMetrics.reduce(
      (sum, m) => sum + (m.grossProfit || 0),
      0,
    );
    const previousGrossProfit = previousMetrics.reduce(
      (sum, m) => sum + (m.grossProfit || 0),
      0,
    );

    const currentOperatingCosts = currentMetrics.reduce(
      (sum, m) => sum + ((m.customCosts || 0) + (m.handlingFees || 0)),
      0,
    );
    const previousOperatingCosts = previousMetrics.reduce(
      (sum, m) => sum + ((m.customCosts || 0) + (m.handlingFees || 0)),
      0,
    );

    const currentNetProfit = currentMetrics.reduce(
      (sum, m) => sum + (m.netProfit || 0),
      0,
    );
    const previousNetProfit = previousMetrics.reduce(
      (sum, m) => sum + (m.netProfit || 0),
      0,
    );

    const currentROAS =
      currentMetrics.reduce((sum, m) => sum + (m.blendedRoas || 0), 0) /
      (currentMetrics.length || 1);
    const previousROAS =
      previousMetrics.reduce((sum, m) => sum + (m.blendedRoas || 0), 0) /
      (previousMetrics.length || 1);

    return {
      currentRevenue,
      previousRevenue,
      revenueChange: currentRevenue - previousRevenue,
      revenueChangePercent:
        previousRevenue > 0
          ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
          : 0,

      currentGrossProfit,
      previousGrossProfit,
      grossProfitChange: currentGrossProfit - previousGrossProfit,
      grossProfitChangePercent:
        previousGrossProfit > 0
          ? ((currentGrossProfit - previousGrossProfit) / previousGrossProfit) *
            100
          : 0,

      currentOperatingCosts,
      previousOperatingCosts,
      operatingCostsChange: currentOperatingCosts - previousOperatingCosts,
      operatingCostsChangePercent:
        previousOperatingCosts > 0
          ? ((currentOperatingCosts - previousOperatingCosts) /
              previousOperatingCosts) *
            100
          : 0,

      currentNetProfit,
      previousNetProfit,
      netProfitChange: currentNetProfit - previousNetProfit,
      netProfitChangePercent:
        previousNetProfit > 0
          ? ((currentNetProfit - previousNetProfit) / previousNetProfit) * 100
          : 0,

      currentROAS,
      previousROAS,
      roasChange: currentROAS - previousROAS,
      roasChangePercent:
        previousROAS > 0
          ? ((currentROAS - previousROAS) / previousROAS) * 100
          : 0,
    };
  },
});

// Get marketing efficiency metrics
export const getMarketingEfficiency = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Get metrics for the period
    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const filteredMetrics = metrics.filter(
      (m) =>
        m.date >= args.dateRange.startDate && m.date <= args.dateRange.endDate,
    );

    // Get customers for LTV calculation
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Calculate CAC (Customer Acquisition Cost)
    const totalAdSpend = filteredMetrics.reduce(
      (sum, m) => sum + (m.totalAdSpend || 0),
      0,
    );
    // For new customers, use creation time
    const startTime = new Date(args.dateRange.startDate).getTime();
    const endTime = new Date(args.dateRange.endDate).getTime() + 86400000; // Add 1 day for inclusive
    const newCustomers = customers.filter(
      (c) => c._creationTime >= startTime && c._creationTime <= endTime,
    ).length;
    const cac = newCustomers > 0 ? totalAdSpend / newCustomers : 0;

    // Calculate LTV (simplified: average customer lifetime value)
    const avgCustomerValue =
      customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
      (customers.length || 1);
    const ltv = avgCustomerValue * 3; // Assume 3x purchase frequency

    // Calculate ROAS by channel
    const metaROAS =
      filteredMetrics.reduce((sum, m) => sum + (m.metaROAS || 0), 0) /
      (filteredMetrics.length || 1);
    const googleROAS =
      filteredMetrics.reduce((sum, m) => sum + (m.googleROAS || 0), 0) /
      (filteredMetrics.length || 1);
    const blendedROAS =
      filteredMetrics.reduce((sum, m) => sum + (m.blendedRoas || 0), 0) /
      (filteredMetrics.length || 1);

    // Calculate payback period (months)
    const avgOrderValue =
      filteredMetrics.reduce((sum, m) => sum + (m.avgOrderValue || 0), 0) /
      (filteredMetrics.length || 1);
    const paybackPeriod = cac > 0 ? cac / (avgOrderValue * 0.3) : 0; // Assume 30% margin

    // Marketing as % of revenue
    const totalRevenue = filteredMetrics.reduce(
      (sum, m) => sum + (m.revenue || 0),
      0,
    );
    const marketingPercentage =
      totalRevenue > 0 ? (totalAdSpend / totalRevenue) * 100 : 0;

    // Trend data for ROAS by channel (synced with date range)
    const trendData = filteredMetrics
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14) // Last 14 days within the range
      .map((m) => ({
        date: m.date,
        metaROAS: m.metaROAS || 0,
        googleROAS: m.googleROAS || 0,
        blendedROAS: m.blendedRoas || 0,
      }));

    return {
      metrics: {
        cac,
        ltv,
        ltvCacRatio: cac > 0 ? ltv / cac : 0,
        paybackPeriod,
        marketingPercentage,
        newCustomers,
      },
      channelROAS: {
        meta: metaROAS,
        google: googleROAS,
        blended: blendedROAS,
      },
      trendData,
    };
  },
});

// Get contribution margin analysis
export const getContributionMargin = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Get metrics for the period
    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const filteredMetrics = metrics.filter(
      (m) =>
        m.date >= args.dateRange.startDate && m.date <= args.dateRange.endDate,
    );

    // Get orders for detailed analysis
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Filter orders by creation time
    const orderStartTime = new Date(args.dateRange.startDate).getTime();
    const orderEndTime = new Date(args.dateRange.endDate).getTime() + 86400000;
    const filteredOrders = orders.filter(
      (o) =>
        o._creationTime >= orderStartTime && o._creationTime <= orderEndTime,
    );

    // Calculate unit economics
    const totalRevenue = filteredMetrics.reduce(
      (sum, m) => sum + (m.revenue || 0),
      0,
    );
    const totalOrders = filteredOrders.length;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Variable costs per order
    const totalCOGS = filteredMetrics.reduce(
      (sum, m) => sum + (m.cogs || 0),
      0,
    );
    const totalShipping = filteredMetrics.reduce(
      (sum, m) => sum + (m.shippingCosts || 0),
      0,
    );
    const totalTransactionFees = filteredMetrics.reduce(
      (sum, m) => sum + (m.transactionFees || 0),
      0,
    );

    const variableCostsPerOrder =
      totalOrders > 0
        ? (totalCOGS + totalShipping + totalTransactionFees) / totalOrders
        : 0;

    const contributionMarginPerOrder = aov - variableCostsPerOrder;
    const contributionMarginPercent =
      aov > 0 ? (contributionMarginPerOrder / aov) * 100 : 0;

    // First order vs repeat order analysis
    const firstTimeOrders = filteredOrders.filter((o) => {
      const orderNum =
        typeof o.orderNumber === "string"
          ? o.orderNumber
          : String(o.orderNumber);

      return orderNum === "1";
    });
    const repeatOrders = filteredOrders.filter((o) => {
      const orderNum =
        typeof o.orderNumber === "string"
          ? parseInt(o.orderNumber, 10)
          : o.orderNumber;

      return orderNum > 1;
    });

    const firstOrderAOV =
      firstTimeOrders.length > 0
        ? firstTimeOrders.reduce((sum, o) => sum + o.totalPrice, 0) /
          firstTimeOrders.length
        : 0;
    const repeatOrderAOV =
      repeatOrders.length > 0
        ? repeatOrders.reduce((sum, o) => sum + o.totalPrice, 0) /
          repeatOrders.length
        : 0;

    // Get top products by margin
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .take(10);

    // Get variants for the products
    const _productIds = products.map((p) => p._id);
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const topProducts = products
      .map((p) => {
        // Find the first variant for this product
        const variant = variants.find((v) => v.productId === p._id);
        const productCost = variant?.costPerItem || 0;
        const productPrice = variant?.price || 0;
        const margin =
          productPrice > 0
            ? ((productPrice - productCost) / productPrice) * 100
            : 0;

        return {
          name: p.title,
          price: productPrice,
          cost: productCost,
          margin,
          contributionProfit: productPrice - productCost,
        };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);

    // Trend data for chart
    const trendData = filteredMetrics.map((m) => ({
      date: m.date,
      revenue: m.revenue || 0,
      variableCosts:
        (m.cogs || 0) + (m.shippingCosts || 0) + (m.transactionFees || 0),
      contributionMargin:
        (m.revenue || 0) -
        ((m.cogs || 0) + (m.shippingCosts || 0) + (m.transactionFees || 0)),
    }));

    return {
      unitEconomics: {
        aov,
        variableCostsPerOrder,
        contributionMarginPerOrder,
        contributionMarginPercent,
        totalOrders,
      },
      orderAnalysis: {
        firstOrderAOV,
        repeatOrderAOV,
        firstOrderCount: firstTimeOrders.length,
        repeatOrderCount: repeatOrders.length,
        repeatRate:
          totalOrders > 0 ? (repeatOrders.length / totalOrders) * 100 : 0,
      },
      topProducts,
      trendData,
    };
  },
});

// Get P&L table data with time-based granularity
export const getTableData = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    granularity: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("total"),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      periods: v.array(
        v.object({
          label: v.string(),
          date: v.string(),
          metrics: v.object({
            revenue: v.number(),
            grossProfit: v.number(),
            netProfit: v.number(),
            netProfitMargin: v.number(),
            cogs: v.number(),
            shippingCosts: v.number(),
            transactionFees: v.number(),
            handlingFees: v.number(),
            taxesPaid: v.number(),
            customCosts: v.number(),
            totalAdSpend: v.number(),
          }),
          growth: v.union(
            v.null(),
            v.object({
              revenue: v.number(),
              netProfit: v.number(),
            }),
          ),
          isTotal: v.optional(v.boolean()),
        }),
      ),
      granularity: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Filter by date range
    const filteredMetrics = metrics
      .filter(
        (m) =>
          m.date >= args.dateRange.startDate &&
          m.date <= args.dateRange.endDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    if (filteredMetrics.length === 0) return null;

    // Helper function to calculate growth percentage
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;

      return ((current - previous) / Math.abs(previous)) * 100;
    };

    // Helper function to aggregate metrics
    const aggregateMetrics = (metricsArray: typeof filteredMetrics) => {
      const _grossSales = metricsArray.reduce(
        (sum, m) => sum + (m.grossSales || 0),
        0,
      );
      const _discounts = metricsArray.reduce(
        (sum, m) => sum + (m.discounts || 0),
        0,
      );
      const _refunds = metricsArray.reduce(
        (sum, m) => sum + (m.refunds || 0),
        0,
      );
      const revenue = metricsArray.reduce(
        (sum, m) => sum + (m.revenue || 0),
        0,
      );
      const cogs = metricsArray.reduce((sum, m) => sum + (m.cogs || 0), 0);
      const shippingCosts = metricsArray.reduce(
        (sum, m) => sum + (m.shippingCosts || 0),
        0,
      );
      const transactionFees = metricsArray.reduce(
        (sum, m) => sum + (m.transactionFees || 0),
        0,
      );
      const handlingFees = metricsArray.reduce(
        (sum, m) => sum + (m.handlingFees || 0),
        0,
      );
      const grossProfit = metricsArray.reduce(
        (sum, m) => sum + (m.grossProfit || 0),
        0,
      );
      const _taxesCollected = metricsArray.reduce(
        (sum, m) => sum + (m.taxesCollected || 0),
        0,
      );
      const taxesPaid = metricsArray.reduce(
        (sum, m) => sum + (m.taxesPaid || 0),
        0,
      );
      const customCosts = metricsArray.reduce(
        (sum, m) => sum + (m.customCosts || 0),
        0,
      );
      const totalAdSpend = metricsArray.reduce(
        (sum, m) => sum + (m.totalAdSpend || 0),
        0,
      );
      const netProfit = metricsArray.reduce(
        (sum, m) => sum + (m.netProfit || 0),
        0,
      );
      const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        // Only return fields defined in the validator
        revenue,
        cogs,
        shippingCosts,
        transactionFees,
        handlingFees,
        grossProfit,
        taxesPaid,
        customCosts,
        totalAdSpend,
        netProfit,
        netProfitMargin,
      };
    };

    // Process data based on granularity
    const periods: {
      label: string;
      date: string;
      metrics: {
        revenue: number;
        grossProfit: number;
        netProfit: number;
        netProfitMargin: number;
        cogs: number;
        shippingCosts: number;
        transactionFees: number;
        handlingFees: number;
        taxesPaid: number;
        customCosts: number;
        totalAdSpend: number;
      };
      growth: {
        revenue: number;
        netProfit: number;
      } | null;
      isTotal?: boolean;
    }[] = [];

    if (args.granularity === "daily") {
      // Process all days in the filtered range
      for (let i = 0; i < filteredMetrics.length; i++) {
        const current = filteredMetrics[i]!;
        const previous = i > 0 ? filteredMetrics[i - 1]! : null;

        const currentMetrics = {
          // Match validator shape exactly
          revenue: current.revenue || 0,
          cogs: current.cogs || 0,
          shippingCosts: current.shippingCosts || 0,
          transactionFees: current.transactionFees || 0,
          handlingFees: current.handlingFees || 0,
          grossProfit: current.grossProfit || 0,
          taxesPaid: current.taxesPaid || 0,
          customCosts: current.customCosts || 0,
          totalAdSpend: current.totalAdSpend || 0,
          netProfit: current.netProfit || 0,
          netProfitMargin:
            (current.revenue || 0) > 0
              ? ((current.netProfit || 0) / (current.revenue || 0)) * 100
              : 0,
        };

        const growth = previous
          ? {
              revenue: calculateGrowth(
                currentMetrics.revenue,
                previous.revenue || 0,
              ),
              netProfit: calculateGrowth(
                currentMetrics.netProfit,
                previous.netProfit || 0,
              ),
            }
          : null;

        periods.push({
          label: new Date(current.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          date: current.date,
          metrics: currentMetrics,
          growth,
        });
      }

      // Add total column
      const totalMetrics = aggregateMetrics(filteredMetrics);

      periods.push({
        label: "Total",
        date: "total",
        metrics: totalMetrics,
        growth: null,
        isTotal: true,
      });
    } else if (args.granularity === "weekly") {
      // Group by week
      const weeks: Map<string, typeof filteredMetrics> = new Map();

      filteredMetrics.forEach((metric) => {
        const date = new Date(metric.date);
        const weekStart = new Date(date);

        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().substring(0, 10);

        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, []);
        }
        weeks.get(weekKey)?.push(metric);
      });

      const weekEntries = Array.from(weeks.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      weekEntries.forEach((week, index) => {
        const currentWeek = aggregateMetrics(week[1]);
        const prevSrc = index > 0 ? weekEntries[index - 1]?.[1] ?? [] : null;
        const previousWeek = prevSrc ? aggregateMetrics(prevSrc) : null;

        const growth = previousWeek
          ? {
              revenue: calculateGrowth(
                currentWeek.revenue,
                previousWeek.revenue,
              ),
              netProfit: calculateGrowth(
                currentWeek.netProfit,
                previousWeek.netProfit,
              ),
            }
          : null;

        periods.push({
          label: `Week ${index + 1}`,
          date: week[0],
          metrics: currentWeek,
          growth,
        });
      });

      // Add total column
      const totalMetrics = aggregateMetrics(filteredMetrics);

      periods.push({
        label: "Total",
        date: "total",
        metrics: totalMetrics,
        growth: null,
        isTotal: true,
      });
    } else if (args.granularity === "monthly") {
      // Group by month
      const months: Map<string, typeof filteredMetrics> = new Map();

      filteredMetrics.forEach((metric) => {
        const date = new Date(metric.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!months.has(monthKey)) {
          months.set(monthKey, []);
        }
        months.get(monthKey)?.push(metric);
      });

      const monthEntries = Array.from(months.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      monthEntries.forEach((month, index) => {
        const currentMonth = aggregateMetrics(month[1]);
        const prevMonthSrc = index > 0 ? monthEntries[index - 1]?.[1] ?? [] : null;
        const previousMonth = prevMonthSrc ? aggregateMetrics(prevMonthSrc) : null;

        const growth = previousMonth
          ? {
              revenue: calculateGrowth(
                currentMonth.revenue,
                previousMonth.revenue,
              ),
              netProfit: calculateGrowth(
                currentMonth.netProfit,
                previousMonth.netProfit,
              ),
            }
          : null;

        const [yearStr, monthNumStr] = month[0].split("-");
        const monthName = new Date(
          parseInt(yearStr || "0", 10),
          parseInt(monthNumStr || "1", 10) - 1,
        ).toLocaleDateString("en-US", { month: "short", year: "numeric" });

        periods.push({
          label: monthName,
          date: month[0],
          metrics: currentMonth,
          growth,
        });
      });

      // Add total column
      const totalMetrics = aggregateMetrics(filteredMetrics);

      periods.push({
        label: "Total",
        date: "total",
        metrics: totalMetrics,
        growth: null,
        isTotal: true,
      });
    }

    return {
      periods,
      granularity: args.granularity,
    };
  },
});
