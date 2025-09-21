import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

/**
 * Public Analytics API
 * Provides analytics data for dashboards and reports
 */

/**
 * Get metrics for date range
 */
export const getMetrics = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    metrics: v.optional(v.array(v.string())),
    granularity: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
  },
  returns: v.union(v.null(), v.array(v.any())),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const orgId = auth.orgId as Id<"organizations">;

    const granularity = args.granularity || "daily";

    // Query the appropriate metrics table using index and filter by date range
    let metricsData:
      | Doc<"metricsDaily">[]
      | Doc<"metricsWeekly">[]
      | Doc<"metricsMonthly">[];

    if (granularity === "daily") {
      const dailyData = await ctx.db
        .query("metricsDaily")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();

      metricsData = dailyData.filter(
        (data) =>
          data.date >= args.dateRange.startDate &&
          data.date <= args.dateRange.endDate,
      );
    } else if (granularity === "weekly") {
      const weeklyData = await ctx.db
        .query("metricsWeekly")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();

      metricsData = weeklyData.filter(
        (data) =>
          data.startDate >= args.dateRange.startDate &&
          data.endDate <= args.dateRange.endDate,
      );
    } else {
      const monthlyData = await ctx.db
        .query("metricsMonthly")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();

      metricsData = monthlyData.filter(
        (data) =>
          data.yearMonth >= args.dateRange.startDate &&
          data.yearMonth <= args.dateRange.endDate,
      );
    }

    // Filter metrics if specific ones requested
    if (args.metrics && args.metrics.length > 0) {
      return metricsData.map(
        (
          data:
            | Doc<"metricsDaily">
            | Doc<"metricsWeekly">
            | Doc<"metricsMonthly">,
        ) => {
          const filtered: Record<string, unknown> = {
            organizationId: data.organizationId,
          };

          // Add the appropriate date field
          if ("date" in data) {
            filtered.date = data.date;
          } else if ("startDate" in data) {
            filtered.date = data.startDate;
          } else if ("yearMonth" in data) {
            filtered.date = data.yearMonth;
          }

          args.metrics?.forEach((metric) => {
            if (metric in data) {
              filtered[metric] = data[metric as keyof typeof data];
            }
          });

          return filtered;
        },
      );
    }

    return metricsData;
  },
});

/**
 * Get product analytics
 */
export const getProductAnalytics = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    productId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      productId: v.string(),
      productName: v.optional(v.string()),
      revenue: v.number(),
      unitsSold: v.number(),
      orders: v.number(),
      profit: v.number(),
      date: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const orgId = auth.orgId as Id<"organizations">;

    // Get product metrics using date range index
    let results = await ctx.db
      .query("productMetrics")
      .withIndex("by_org_product_date", (q) => {
        const query = q.eq("organizationId", orgId);

        if (args.productId) {
          return query
            .eq("productId", args.productId as Id<"shopifyProducts">)
            .gte("date", args.dateRange.startDate)
            .lte("date", args.dateRange.endDate);
        }

        // If no productId, we need to use by_organization and filter dates
        return query;
      })
      .collect();

    // Filter dates if we couldn't use the full index
    if (!args.productId) {
      results = results.filter(
        (metric) =>
          metric.date >= args.dateRange.startDate &&
          metric.date <= args.dateRange.endDate,
      );
    }

    // Already filtered by productId in the query if provided

    // Aggregate by product if no specific product requested
    if (!args.productId) {
      const aggregated = new Map<
        string,
        {
          productId: string;
          productName: string;
          revenue: number;
          unitsSold: number;
          orders: number;
          profit: number;
        }
      >();

      results.forEach((metric) => {
        const existing = aggregated.get(metric.productId) || {
          productId: metric.productId,
          productName: "", // TODO: Join with product data
          revenue: 0,
          unitsSold: 0,
          orders: 0,
          profit: 0,
        };

        existing.revenue += metric.revenue || 0;
        existing.unitsSold += metric.unitsSold || 0;
        existing.orders += metric.orders || 0;
        existing.profit += metric.profit || 0;

        aggregated.set(metric.productId, existing);
      });

      return Array.from(aggregated.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, args.limit || 100);
    }

    return results;
  },
});

/**
 * Get channel performance
 */
export const getChannelPerformance = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    channel: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      channel: v.string(),
      spend: v.number(),
      revenue: v.number(),
      conversions: v.number(),
      impressions: v.number(),
      clicks: v.number(),
      roas: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const id = auth.orgId as Id<"organizations">;

    // Get channel metrics using date range index
    let results = await ctx.db
      .query("channelMetrics")
      .withIndex("by_org_channel_date", (q) => {
        const query = q.eq("organizationId", id as Id<"organizations">);

        if (args.channel) {
          return query
            .eq("channel", args.channel)
            .gte("date", args.dateRange.startDate)
            .lte("date", args.dateRange.endDate);
        }

        // If no channel, we need to use by_organization and filter dates
        return query;
      })
      .collect();

    // Filter dates if we couldn't use the full index
    if (!args.channel) {
      results = results.filter(
        (metric) =>
          metric.date >= args.dateRange.startDate &&
          metric.date <= args.dateRange.endDate,
      );
    }

    if (args.channel) {
      results = results.filter((metric) => metric.channel === args.channel);
    }

    // Aggregate by channel
    const aggregated = new Map();

    results.forEach((metric) => {
      const existing = aggregated.get(metric.channel) || {
        channel: metric.channel,
        spend: 0,
        revenue: 0,
        conversions: 0,
        impressions: 0,
        clicks: 0,
        roas: 0,
      };

      existing.spend += metric.adSpend || 0;
      existing.revenue += metric.revenue || 0;
      existing.conversions += metric.purchases || 0;
      existing.impressions += metric.impressions || 0;
      existing.clicks += metric.clicks || 0;

      aggregated.set(metric.channel, existing);
    });

    // Calculate ROAS for each channel
    aggregated.forEach((channel) => {
      if (channel.spend > 0) {
        channel.roas = channel.revenue / channel.spend;
      }
    });

    return Array.from(aggregated.values());
  },
});

/**
 * Get customer insights
 */
export const getCustomerInsights = query({
  args: {
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    segment: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalCustomers: v.number(),
      newCustomers: v.number(),
      returningCustomers: v.number(),
      avgOrderValue: v.number(),
      avgLifetimeValue: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const orgId = auth.orgId as Id<"organizations">;

    // Get customer metrics for date range
    const customerMetrics = await ctx.db
      .query("customerMetrics")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect()
      .then((metrics) =>
        metrics.filter(
          (metric) =>
            metric.date >= args.dateRange.startDate &&
            metric.date <= args.dateRange.endDate,
        ),
      );

    // Calculate insights
    const totalCustomers = new Set(customerMetrics.map((m) => m.customerId))
      .size;
    const newCustomers = customerMetrics.filter(
      (m) =>
        m.firstOrderDate >= args.dateRange.startDate &&
        m.firstOrderDate <= args.dateRange.endDate,
    ).length;
    const returningCustomers = totalCustomers - newCustomers;

    const totalRevenue = customerMetrics.reduce(
      (sum, m) => sum + (m.lifetimeValue || 0),
      0,
    );
    const totalOrders = customerMetrics.reduce(
      (sum, m) => sum + (m.lifetimeOrders || 0),
      0,
    );

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      avgLifetimeValue: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
    };
  },
});

/**
 * Get real-time metrics
 */
export const getRealtimeMetrics = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      revenue: v.number(),
      orders: v.number(),
      customers: v.number(),
      avgOrderValue: v.number(),
      conversionRate: v.number(),
      cartAbandonment: v.number(),
      lastUpdated: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const orgId = auth.orgId as Id<"organizations">;

    // Get cached real-time metrics
    const realtimeMetrics = await ctx.db
      .query("realtimeMetrics")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .first();

    if (!realtimeMetrics) {
      // Return zeros if no metrics yet
      return {
        revenue: 0,
        orders: 0,
        customers: 0,
        avgOrderValue: 0,
        conversionRate: 0,
        cartAbandonment: 0,
        lastUpdated: Date.now(),
      };
    }

    return {
      revenue: realtimeMetrics.value || 0,
      orders: 0, // These would need to be properly extracted from realtimeMetrics
      customers: 0,
      avgOrderValue: 0,
      conversionRate: 0,
      cartAbandonment: 0,
      lastUpdated: realtimeMetrics._creationTime || Date.now(),
    };
  },
});

/**
 * Get product performance
 * Alias for getProductAnalytics for hook compatibility
 */
export const getProductPerformance = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    productIds: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      productId: v.string(),
      productName: v.optional(v.string()),
      revenue: v.number(),
      unitsSold: v.number(),
      orders: v.number(),
      profit: v.number(),
      date: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const organizationId = auth.orgId;

    // Get product metrics with optional filtering
    const productsQuery = ctx.db
      .query("productMetrics")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      );

    const products = await productsQuery.take(args.limit || 100);

    // Filter by date range and product IDs if provided
    let filteredProducts = products;

    if (args.dateRange?.startDate && args.dateRange.endDate) {
      const { startDate, endDate } = args.dateRange;
      filteredProducts = filteredProducts.filter((p) => {
        const productDate = new Date(p.syncedAt || 0);
        const start = new Date(startDate);
        const end = new Date(endDate);

        return productDate >= start && productDate <= end;
      });
    }

    if (args.productIds) {
      filteredProducts = filteredProducts.filter((p) =>
        args.productIds?.includes(p.productId),
      );
    }

    return filteredProducts.map((p) => ({
      productId: p.productId,
      productName: undefined, // Not in productMetrics schema
      revenue: p.revenue,
      unitsSold: p.unitsSold,
      orders: p.orders,
      profit: p.profit,
      date: p.syncedAt
        ? new Date(p.syncedAt).toISOString().split("T")[0]
        : undefined,
    }));
  },
});

/**
 * Get platform-specific metrics (Shopify, Meta, Google)
 * Returns aggregated metrics for the specified date range
 */
export const getPlatformMetrics = query({
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
      // Shopify metrics
      shopifySessions: v.number(),
      shopifyConversionRate: v.number(),
      shopifyAbandonedCarts: v.number(),
      shopifyCheckoutRate: v.number(),

      // Meta metrics
      metaSessions: v.number(),
      metaConversion: v.number(),
      metaImpressions: v.number(),
      metaCTR: v.number(),
      metaReach: v.number(),
      metaFrequency: v.number(),
      metaUniqueClicks: v.number(),
      metaCPC: v.number(),
      metaCostPerConversion: v.number(),
      metaAddToCart: v.number(),
      metaInitiateCheckout: v.number(),
      metaPageViews: v.number(),
      metaViewContent: v.number(),
      metaLinkClicks: v.number(),
      metaOutboundClicks: v.number(),
      metaLandingPageViews: v.number(),
      metaVideoViews: v.number(),
      metaVideo3SecViews: v.number(),
      metaCostPerThruPlay: v.number(),

      // Google metrics
      googleSessions: v.number(),
      googleConversion: v.number(),
      googleClicks: v.number(),
      googleCTR: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const id = auth.orgId as Id<"organizations"> | undefined;
    // Get date range - default to last 30 days if not provided
    const endDate =
      args.dateRange?.endDate ?? new Date().toISOString().substring(0, 10);
    const startDate =
      args.dateRange?.startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);

    // Get metrics from daily table
    const metricsData = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", id as Id<"organizations">),
      )
      .collect();

    // Filter by date range
    const filteredData = metricsData.filter(
      (data) => data.date >= startDate && data.date <= endDate,
    );

    if (filteredData.length === 0) {
      // Return zeros if no data
      return {
        shopifySessions: 0,
        shopifyConversionRate: 0,
        shopifyAbandonedCarts: 0,
        shopifyCheckoutRate: 0,
        metaSessions: 0,
        metaConversion: 0,
        metaImpressions: 0,
        metaCTR: 0,
        metaReach: 0,
        metaFrequency: 0,
        metaUniqueClicks: 0,
        metaCPC: 0,
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
      metaCostPerThruPlay: 0,
      googleSessions: 0,
        googleConversion: 0,
        googleClicks: 0,
        googleCTR: 0,
      };
    }

    // Also get direct Meta insights data for more accurate metrics
    const metaInsights = await ctx.db
      .query("metaInsights")
      .withIndex("by_org_date", (q) =>
        q
          .eq("organizationId", id as Id<"organizations">)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .collect();

    // Aggregate platform metrics across the date range
    const aggregated = filteredData.reduce(
      (acc, day) => {
        // Shopify metrics
        acc.shopifySessions += day.shopifySessions || 0;
        acc.totalShopifyOrders += day.orders || 0;

        // Meta metrics from metricsDaily
        acc.metaClicks += day.metaClicks || 0;
        acc.metaPurchases += day.metaPurchases || 0;

        // Google metrics
        acc.googleClicks += day.googleClicks || 0;
        acc.googleConversions += day.googleConversions || 0;
        acc.googleImpressions += day.blendedCPC
          ? ((day.googleClicks || 0) / (day.blendedCTR || 0.01)) * 100
          : 0;

        return acc;
      },
      {
        shopifySessions: 0,
        totalShopifyOrders: 0,
        metaClicks: 0,
        metaPurchases: 0,
        metaImpressions: 0,
        metaCTR: 0,
        googleClicks: 0,
        googleConversions: 0,
        googleImpressions: 0,
      },
    );

    // Aggregate Meta insights for more accurate data
    const metaAggregated = metaInsights.reduce(
      (acc, insight) => {
        const impressions = insight.impressions || 0;
        const clicks = insight.clicks || 0;
        const conversions = insight.conversions || 0;
        const spend = insight.spend || 0;

        acc.impressions += impressions;
        acc.clicks += clicks;
        acc.uniqueClicks += insight.uniqueClicks || 0;
        acc.conversions += conversions;
        acc.spend += spend;
        acc.reach += insight.reach || 0;
        acc.freqContrib.impressions += impressions;
        acc.freqContrib.reach += insight.reach || 0;

        // Other actions
        acc.addToCart += insight.addToCart || 0;
        acc.initiateCheckout += insight.initiateCheckout || 0;
        acc.pageViews += insight.pageViews || 0;
        acc.viewContent += insight.viewContent || 0;
        acc.linkClicks += insight.linkClicks || 0;
        acc.outboundClicks += insight.outboundClicks || 0;
        acc.landingPageViews += insight.landingPageViews || 0;

        // Video metrics
        acc.videoViews += insight.videoViews || 0;
        acc.video3SecViews += insight.video3SecViews || 0;
        acc.videoThruPlay += insight.videoThruPlay || 0;

        return acc;
      },
      {
        impressions: 0,
        clicks: 0,
        uniqueClicks: 0,
        conversions: 0,
        spend: 0,
        reach: 0,
        freqContrib: { impressions: 0, reach: 0 },
        addToCart: 0,
        initiateCheckout: 0,
        pageViews: 0,
        viewContent: 0,
        linkClicks: 0,
        outboundClicks: 0,
        landingPageViews: 0,
        videoViews: 0,
        video3SecViews: 0,
        videoThruPlay: 0,
      },
    );

    // Use Meta insights data if available, otherwise fall back to metricsDaily
    if (metaAggregated.impressions > 0) {
      aggregated.metaImpressions = metaAggregated.impressions;
      aggregated.metaClicks = metaAggregated.clicks;
      aggregated.metaPurchases = metaAggregated.conversions;
      aggregated.metaCTR =
        metaAggregated.impressions > 0
          ? (metaAggregated.clicks / metaAggregated.impressions) * 100
          : 0;
    }

    // Get abandoned carts count
    const abandonedCarts = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", id as Id<"organizations">),
      )
      .collect();

    const abandonedCount = abandonedCarts.filter((order) => {
      const orderDate = order.shopifyCreatedAt
        ? new Date(order.shopifyCreatedAt).toISOString().substring(0, 10)
        : null;

      return (
        order.financialStatus === "pending" &&
        orderDate &&
        orderDate >= startDate &&
        orderDate <= endDate
      );
    }).length;

    // Calculate rates and percentages
    return {
      // Shopify metrics
      shopifySessions: aggregated.shopifySessions,
      shopifyConversionRate:
        aggregated.shopifySessions > 0
          ? (aggregated.totalShopifyOrders / aggregated.shopifySessions) * 100
          : 0,
      shopifyAbandonedCarts: abandonedCount,
      shopifyCheckoutRate:
        aggregated.shopifySessions > 0
          ? ((aggregated.shopifySessions - abandonedCount) /
              aggregated.shopifySessions) *
            100
          : 0,

      // Meta metrics
      metaSessions: aggregated.metaClicks, // Using clicks as proxy for sessions
      metaConversion:
        aggregated.metaClicks > 0
          ? (aggregated.metaPurchases / aggregated.metaClicks) * 100
          : 0,
      metaImpressions: Math.round(aggregated.metaImpressions),
      metaCTR:
        aggregated.metaCTR ||
        (aggregated.metaImpressions > 0
          ? (aggregated.metaClicks / aggregated.metaImpressions) * 100
          : 0),
      metaReach: Math.round(metaAggregated.reach || 0),
      metaFrequency:
        metaAggregated.freqContrib.reach > 0
          ? metaAggregated.freqContrib.impressions /
            metaAggregated.freqContrib.reach
          : 0,
      metaUniqueClicks: Math.round(metaAggregated.uniqueClicks || 0),
      metaCPC:
        metaAggregated.clicks > 0
          ? metaAggregated.spend / metaAggregated.clicks
          : 0,
      metaCostPerConversion:
        metaAggregated.conversions > 0
          ? metaAggregated.spend / metaAggregated.conversions
          : 0,
      metaAddToCart: metaAggregated.addToCart,
      metaInitiateCheckout: metaAggregated.initiateCheckout,
      metaPageViews: metaAggregated.pageViews,
      metaViewContent: metaAggregated.viewContent,
      metaLinkClicks: metaAggregated.linkClicks,
      metaOutboundClicks: metaAggregated.outboundClicks,
      metaLandingPageViews: metaAggregated.landingPageViews,
      metaVideoViews: metaAggregated.videoViews,
      metaVideo3SecViews: metaAggregated.video3SecViews,
      metaCostPerThruPlay:
        metaAggregated.videoThruPlay > 0
          ? metaAggregated.spend / metaAggregated.videoThruPlay
          : 0,

      // Google metrics
      googleSessions: aggregated.googleClicks, // Using clicks as proxy for sessions
      googleConversion:
        aggregated.googleClicks > 0
          ? (aggregated.googleConversions / aggregated.googleClicks) * 100
          : 0,
      googleClicks: aggregated.googleClicks,
      googleCTR:
        aggregated.googleImpressions > 0
          ? (aggregated.googleClicks / aggregated.googleImpressions) * 100
          : 0,
    };
  },
});

/**
 * Get channel revenue breakdown
 * Returns revenue by marketing channel based on UTM attribution
 */
export const getChannelRevenue = query({
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
      totalRevenue: v.number(),
      channels: v.array(
        v.object({
          name: v.string(),
          revenue: v.number(),
          orders: v.number(),
          percentage: v.number(),
          change: v.number(),
          changeType: v.union(
            v.literal("positive"),
            v.literal("negative"),
            v.literal("neutral"),
          ),
        }),
      ),
      timeSeries: v.array(
        v.object({
          date: v.string(),
          shopify: v.number(),
          organic: v.number(),
          meta: v.number(),
          google: v.number(),
          other: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const id = auth.orgId as Id<"organizations">;

    // Get date range - default to last 30 days
    const endDate =
      args.dateRange?.endDate ?? new Date().toISOString().substring(0, 10);
    const startDate =
      args.dateRange?.startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);

    // Calculate previous period for comparison
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - periodLength);
    const previousEnd = new Date(currentStart.getTime() - 1);

    // Get all orders for current and previous periods
    const allOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", id))
      .collect();

    // Filter orders by date ranges
    const currentOrders = allOrders.filter((order) => {
      const orderDate = order.shopifyCreatedAt
        ? new Date(order.shopifyCreatedAt).toISOString().substring(0, 10)
        : null;

      return orderDate && orderDate >= startDate && orderDate <= endDate;
    });

    const previousOrders = allOrders.filter((order) => {
      const orderDate = order.shopifyCreatedAt
        ? new Date(order.shopifyCreatedAt).toISOString().substring(0, 10)
        : null;

      return (
        orderDate &&
        orderDate >= previousStart.toISOString().substring(0, 10) &&
        orderDate <= previousEnd.toISOString().substring(0, 10)
      );
    });

    // Categorize orders by channel using UTM parameters
    const categorizeChannel = (order: Doc<"shopifyOrders">) => {
      const utmSource = order.utmSource?.toLowerCase() || "";
      const utmMedium = order.utmMedium?.toLowerCase() || "";
      const referringSite = order.referringSite?.toLowerCase() || "";

      // Meta/Facebook attribution
      if (
        utmSource.includes("facebook") ||
        utmSource.includes("fb") ||
        utmSource.includes("instagram") ||
        utmSource.includes("ig") ||
        utmSource.includes("meta") ||
        referringSite.includes("facebook") ||
        referringSite.includes("instagram")
      ) {
        return "meta";
      }

      // Google attribution
      if (
        utmSource.includes("google") ||
        utmSource.includes("adwords") ||
        utmMedium === "cpc" ||
        referringSite.includes("google")
      ) {
        return "google";
      }

      // Other paid channels
      if (
        utmMedium === "paid" ||
        utmMedium === "cpc" ||
        utmMedium === "ppc" ||
        utmMedium === "cpm"
      ) {
        return "other";
      }

      // Organic/direct
      return "organic";
    };

    // Calculate channel revenue for current period
    const currentChannelData = currentOrders.reduce(
      (acc, order) => {
        const channel = categorizeChannel(order);

        acc[channel].revenue += order.totalPrice || 0;
        acc[channel].orders += 1;

        return acc;
      },
      {
        organic: { revenue: 0, orders: 0 },
        meta: { revenue: 0, orders: 0 },
        google: { revenue: 0, orders: 0 },
        other: { revenue: 0, orders: 0 },
      },
    );

    // Calculate channel revenue for previous period
    const previousChannelData = previousOrders.reduce(
      (acc, order) => {
        const channel = categorizeChannel(order);

        acc[channel].revenue += order.totalPrice || 0;
        acc[channel].orders += 1;

        return acc;
      },
      {
        organic: { revenue: 0, orders: 0 },
        meta: { revenue: 0, orders: 0 },
        google: { revenue: 0, orders: 0 },
        other: { revenue: 0, orders: 0 },
      },
    );

    // Calculate total revenue
    const totalRevenue = Object.values(currentChannelData).reduce(
      (sum, channel) => sum + channel.revenue,
      0,
    );

    // Build channel array with calculations
    const channels = [
      {
        name: "Shopify Total",
        revenue: totalRevenue,
        orders: currentOrders.length,
        percentage: 100,
        change:
          previousOrders.length > 0
            ? ((currentOrders.length - previousOrders.length) /
                previousOrders.length) *
              100
            : 0,
        changeType: (currentOrders.length >= previousOrders.length
          ? "positive"
          : "negative") as "positive" | "negative" | "neutral",
      },
      {
        name: "Organic",
        revenue: currentChannelData.organic.revenue,
        orders: currentChannelData.organic.orders,
        percentage:
          totalRevenue > 0
            ? (currentChannelData.organic.revenue / totalRevenue) * 100
            : 0,
        change:
          previousChannelData.organic.revenue > 0
            ? ((currentChannelData.organic.revenue -
                previousChannelData.organic.revenue) /
                previousChannelData.organic.revenue) *
              100
            : 0,
        changeType: (currentChannelData.organic.revenue >=
        previousChannelData.organic.revenue
          ? "positive"
          : "negative") as "positive" | "negative" | "neutral",
      },
      {
        name: "Meta Ads",
        revenue: currentChannelData.meta.revenue,
        orders: currentChannelData.meta.orders,
        percentage:
          totalRevenue > 0
            ? (currentChannelData.meta.revenue / totalRevenue) * 100
            : 0,
        change:
          previousChannelData.meta.revenue > 0
            ? ((currentChannelData.meta.revenue -
                previousChannelData.meta.revenue) /
                previousChannelData.meta.revenue) *
              100
            : 0,
        changeType: (currentChannelData.meta.revenue >=
        previousChannelData.meta.revenue
          ? "positive"
          : "negative") as "positive" | "negative" | "neutral",
      },
      {
        name: "Google Ads",
        revenue: currentChannelData.google.revenue,
        orders: currentChannelData.google.orders,
        percentage:
          totalRevenue > 0
            ? (currentChannelData.google.revenue / totalRevenue) * 100
            : 0,
        change:
          previousChannelData.google.revenue > 0
            ? ((currentChannelData.google.revenue -
                previousChannelData.google.revenue) /
                previousChannelData.google.revenue) *
              100
            : 0,
        changeType: (currentChannelData.google.revenue >=
        previousChannelData.google.revenue
          ? "positive"
          : "negative") as "positive" | "negative" | "neutral",
      },
    ];

    // Generate time series data
    const generateTimeSeries = () => {
      const days = Math.ceil(
        (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const useWeekly = days > 30;
      const dataPoints = useWeekly ? Math.ceil(days / 7) : Math.min(days, 30);

      const timeSeries = [];

      for (let i = 0; i < dataPoints; i++) {
        const periodStart = new Date(currentStart);
        const periodEnd = new Date(currentStart);

        if (useWeekly) {
          periodStart.setDate(periodStart.getDate() + i * 7);
          periodEnd.setDate(periodStart.getDate() + 7);
        } else {
          periodStart.setDate(periodStart.getDate() + i);
          periodEnd.setDate(periodStart.getDate() + 1);
        }

        // Get orders for this period
        const periodOrders = currentOrders.filter((order) => {
          const orderDate = order.shopifyCreatedAt
            ? new Date(order.shopifyCreatedAt)
            : null;

          return orderDate && orderDate >= periodStart && orderDate < periodEnd;
        });

        // Calculate revenue by channel for this period
        const periodData = periodOrders.reduce(
          (acc, order) => {
            const channel = categorizeChannel(order);

            acc[channel] += order.totalPrice || 0;
            acc.shopify += order.totalPrice || 0;

            return acc;
          },
          {
            shopify: 0,
            organic: 0,
            meta: 0,
            google: 0,
            other: 0,
          },
        );

        timeSeries.push({
          date: periodStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          ...periodData,
        });
      }

      return timeSeries;
    };

    return {
      totalRevenue,
      channels,
      timeSeries: generateTimeSeries(),
    };
  },
});

/**
 * Get customer analytics
 * Wrapper for getCustomerInsights with different response structure
 */
export const getCustomerAnalytics = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    segmentation: v.optional(
      v.union(v.literal("new"), v.literal("returning"), v.literal("churned")),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalCustomers: v.number(),
      newCustomers: v.number(),
      returningCustomers: v.number(),
      customerLifetimeValue: v.number(),
      averageOrderValue: v.number(),
      churnRate: v.number(),
    }),
  ),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const id = auth.orgId as Id<"organizations">;

    // Get customer metrics
    const customers = await ctx.db
      .query("customerMetrics")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", id as Id<"organizations">),
      )
      .collect();

    const totalCustomers = customers.length;
    const newCustomers = customers.filter((c) => c.lifetimeOrders === 1).length;
    const returningCustomers = customers.filter(
      (c) => c.lifetimeOrders > 1,
    ).length;
    const avgLifetimeValue =
      customers.reduce((sum, c) => sum + (c.lifetimeValue || 0), 0) /
      (totalCustomers || 1);
    const avgOrderValue =
      customers.reduce((sum, c) => sum + (c.avgOrderValue || 0), 0) /
      (totalCustomers || 1);

    // Calculate retention rate
    const activeCustomers = customers.filter((c) => {
      const lastOrder = c.lastOrderDate ? new Date(c.lastOrderDate) : null;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      return lastOrder && lastOrder > thirtyDaysAgo;
    }).length;

    const churnRate =
      totalCustomers > 0
        ? ((totalCustomers - activeCustomers) / totalCustomers) * 100
        : 0;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      customerLifetimeValue: avgLifetimeValue,
      averageOrderValue: avgOrderValue,
      churnRate,
    };
  },
});

/**
 * Get real-time metrics (alias for getRealtimeMetrics)
 */
export const getRealTimeMetrics = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      revenue: v.number(),
      orders: v.number(),
      visitors: v.number(),
      conversions: v.number(),
      lastUpdated: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const orgId = auth.orgId as Id<"organizations">;

    // Get real-time metrics from cache
    const cached = await ctx.db
      .query("realtimeMetrics")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", orgId).eq("metricType", "summary"),
      )
      .first();

    if (!cached) return null;

    return {
      revenue: cached.value as number,
      orders: 0, // Not tracked in realtimeMetrics
      visitors: 0, // Not tracked yet
      conversions: 0, // Not tracked in realtimeMetrics
      lastUpdated: cached._creationTime || Date.now(),
    };
  },
});

/**
 * Get profit & loss overview
 */
export const getProfitLossOverview = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    granularity: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      revenue: v.number(),
      cogs: v.number(),
      grossProfit: v.number(),
      expenses: v.number(),
      netProfit: v.number(),
      grossMargin: v.number(),
      netMargin: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const orgId = auth.orgId as Id<"organizations"> | undefined;

    const dateRange = args.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
    };

    // Get metrics for the period
    const metrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", orgId as Id<"organizations">),
      )
      .collect()
      .then((allMetrics) => {
        const start = dateRange.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .substring(0, 10);
        const end = dateRange.endDate ?? new Date().toISOString().substring(0, 10);
        return allMetrics.filter((m) => m.date >= start && m.date <= end);
      });

    // Aggregate P&L data
    const pnl = metrics.reduce(
      (acc, m) => {
        acc.revenue += m.revenue || 0;
        acc.cogs += m.totalCosts || 0; // Use totalCosts field
        acc.expenses +=
          (m.shippingCosts || 0) + // Use shippingCosts (plural)
          (m.transactionFees || 0) +
          (m.taxesPaid || 0) + // Use totalTaxes field
          (m.totalAdSpend || 0);
        acc.grossProfit += m.grossProfit || 0;
        acc.netProfit += m.netProfit || 0;

        return acc;
      },
      {
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
      },
    );

    return {
      revenue: pnl.revenue,
      cogs: pnl.cogs,
      grossProfit: pnl.grossProfit,
      expenses: pnl.expenses,
      netProfit: pnl.netProfit,
      grossMargin: pnl.revenue > 0 ? (pnl.grossProfit / pnl.revenue) * 100 : 0,
      netMargin: pnl.revenue > 0 ? (pnl.netProfit / pnl.revenue) * 100 : 0,
    };
  },
});

/**
 * Get cohort analysis
 */
export const getCohortAnalysis = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    cohortType: v.optional(v.union(v.literal("monthly"), v.literal("weekly"))),
  },
  returns: v.array(
    v.object({
      cohort: v.string(),
      size: v.number(),
      retention: v.array(v.number()),
      revenue: v.array(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    // For now, return mock cohort data
    // TODO: Implement actual cohort analysis
    return [
      {
        cohort: "2024-01",
        size: 100,
        retention: [100, 85, 70, 65, 60, 58],
        revenue: [5000, 4250, 3500, 3250, 3000, 2900],
      },
      {
        cohort: "2024-02",
        size: 120,
        retention: [100, 88, 75, 70, 65],
        revenue: [6000, 5280, 4500, 4200, 3900],
      },
      {
        cohort: "2024-03",
        size: 150,
        retention: [100, 90, 80, 75],
        revenue: [7500, 6750, 6000, 5625],
      },
    ];
  },
});

/**
 * Get comparison metrics
 */
export const getComparisonMetrics = query({
  args: {
    currentPeriod: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    comparisonType: v.union(
      v.literal("previous_period"),
      v.literal("last_year"),
      v.literal("last_month"),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      current: v.object({
        revenue: v.number(),
        profit: v.number(),
        orders: v.number(),
        customers: v.number(),
        adSpend: v.number(),
      }),
      comparison: v.object({
        revenue: v.number(),
        profit: v.number(),
        orders: v.number(),
        customers: v.number(),
        adSpend: v.number(),
      }),
      changes: v.object({
        revenue: v.number(),
        profit: v.number(),
        orders: v.number(),
        customers: v.number(),
        adSpend: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const orgId = auth.orgId as Id<"organizations">;
    // Calculate comparison period
    const start = new Date(args.currentPeriod.startDate);
    const end = new Date(args.currentPeriod.endDate);
    const daysDiff = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    const comparisonStart = new Date(start);
    const comparisonEnd = new Date(end);

    switch (args.comparisonType) {
      case "previous_period":
        comparisonStart.setDate(comparisonStart.getDate() - daysDiff - 1);
        comparisonEnd.setDate(comparisonEnd.getDate() - daysDiff - 1);
        break;
      case "last_year":
        comparisonStart.setFullYear(comparisonStart.getFullYear() - 1);
        comparisonEnd.setFullYear(comparisonEnd.getFullYear() - 1);
        break;
      case "last_month":
        comparisonStart.setMonth(comparisonStart.getMonth() - 1);
        comparisonEnd.setMonth(comparisonEnd.getMonth() - 1);
        break;
    }

    // Get metrics for both periods
    const [currentMetrics, comparisonMetrics] = await Promise.all([
      ctx.db
        .query("metricsDaily")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId as Id<"organizations">),
        )
        .collect()
        .then((metrics) =>
          metrics.filter(
            (m) =>
              m.date >= args.currentPeriod.startDate &&
              m.date <= args.currentPeriod.endDate,
          ),
        ),
      ctx.db
        .query("metricsDaily")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId as Id<"organizations">),
        )
        .collect()
        .then((metrics) =>
          metrics.filter((m) =>
            m.date >= comparisonStart.toISOString().substring(0, 10) &&
            m.date <= comparisonEnd.toISOString().substring(0, 10),
          ),
        ),
    ]);

    // Aggregate metrics
    const aggregateMetrics = (metrics: typeof currentMetrics) => {
      return metrics.reduce(
        (acc, m) => {
          acc.revenue += m.revenue || 0;
          acc.profit += m.netProfit || 0;
          acc.orders += m.orders || 0;
          acc.customers += m.totalCustomers || 0;
          acc.adSpend += m.totalAdSpend || 0;

          return acc;
        },
        {
          revenue: 0,
          profit: 0,
          orders: 0,
          customers: 0,
          adSpend: 0,
        },
      );
    };

    const current = aggregateMetrics(currentMetrics);
    const comparison = aggregateMetrics(comparisonMetrics);

    // Calculate changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;

      return ((current - previous) / previous) * 100;
    };

    return {
      current,
      comparison,
      changes: {
        revenue: calculateChange(current.revenue, comparison.revenue),
        profit: calculateChange(current.profit, comparison.profit),
        orders: calculateChange(current.orders, comparison.orders),
        customers: calculateChange(current.customers, comparison.customers),
        adSpend: calculateChange(current.adSpend, comparison.adSpend),
      },
    };
  },
});
