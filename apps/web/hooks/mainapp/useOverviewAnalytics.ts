import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { getCurrencySymbol } from "@/libs/utils/format";
import {
  useIntegrationStatus,
  useUser,
  useOrganizationTimeZone,
} from "./useUser";

/**
 * Overview Analytics Hooks
 * For dashboard overview data and summary metrics
 */

// ============ MAIN OVERVIEW HOOK ============

/**
 * Main hook for overview analytics page
 * Combines all necessary data for the dashboard overview
 */
export function useOverviewAnalytics(dateRange?: {
  startDate: string;
  endDate: string;
}) {
  // Get sync status and integration info
  const integrationStatus = useIntegrationStatus();
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);
  const { timezone } = useOrganizationTimeZone();

  // Calculate timeRange from dateRange if provided
  const timeRange = dateRange ? undefined : "30d"; // Use custom range if provided

  // Get dashboard summary metrics with custom date range if provided
  const summary = useQuery(api.web.dashboard.getDashboardSummary, {
    timeRange, // Will be "30d" or undefined based on dateRange
    ...(dateRange && toUtcRangeStrings(dateRange, timezone)),
  });

  // Get analytics metrics if date range is provided
  // const _analyticsMetrics = useQuery(
  //   api.web.analytics.getMetrics,
  //   dateRange ? { dateRange, granularity: "daily" as const } : "skip",
  // );

  // Get real-time metrics
  const realTimeMetrics = useQuery(api.web.analytics.getRealTimeMetrics);

  // Get sync sessions for monitoring
  const syncSessions = useQuery(api.web.sync.getActiveSyncSessions);

  const isLoading = summary === undefined;
  const isSyncing = syncSessions?.some((s) => s.status === "syncing") || false;
  const isCalculating = false;

  // Build sync status object
  const syncStatus = syncSessions
    ? {
        shopify: syncSessions.find((s) => s.platform === "shopify"),
        meta: syncSessions.find((s) => s.platform === "meta"),
      }
    : null;

  if (process.env.NODE_ENV !== "production" && summary) {
    console.debug("[useOverviewAnalytics] Summary data received", {
      revenue: summary.revenue,
      orders: summary.orders,
      profit: summary.profit,
      adSpend: summary.adSpend,
      grossSales: summary.grossSales,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug("[useOverviewAnalytics] realTimeMetrics", realTimeMetrics);
    console.debug("[useOverviewAnalytics] Metrics will be created", !!summary);
  }

  // Prepare metrics in the format expected by AnalyticsOverview component
  const metrics = summary
    ? {
        // Key Performance Indicators
        revenue: {
          label: "Revenue",
          value: summary.revenue || 0,
          change: summary.revenueChange || 0,
          prefix: currencySymbol,
        },
        netProfit: {
          label: "Net Profit",
          value: summary.profit || 0,
          change: summary.profitChange || 0,
          prefix: currencySymbol,
        },
        netProfitMargin: {
          label: "Profit Margin",
          value: summary.profitMargin || 0,
          change: summary.profitMarginChange || 0,
          suffix: "%",
          decimal: 1,
        },
        orders: {
          label: "Orders",
          value: summary.orders || 0,
          change: summary.ordersChange || 0,
        },
        avgOrderValue: {
          label: "AOV",
          value: summary.avgOrderValue || 0,
          change: summary.avgOrderValueChange || 0,
          prefix: currencySymbol,
          decimal: 2,
        },
        blendedRoas: {
          label: "ROAS",
          value: summary.roas || 0,
          change: summary.roasChange || 0,
          decimal: 2,
        },

        // Growth
        moMRevenueGrowth: {
          label: "MoM Revenue Growth",
          value: summary.revenueChange || 0,
          change: summary.revenueChange || 0,
          suffix: "%",
          decimal: 1,
        },
        calendarMoMRevenueGrowth: {
          label: "MoM Rev Growth (Cal)",
          value: summary.calendarMoMRevenueGrowth || 0,
          change: summary.calendarMoMRevenueGrowth || 0,
          suffix: "%",
          decimal: 1,
        },

        // Revenue & Margins (from actual data)
        grossSales: {
          label: "Gross Sales",
          value: summary.grossSales || 0,
          change: summary.grossSalesChange || 0,
          prefix: currencySymbol,
        },
        discounts: {
          label: "Discounts",
          value: summary.discounts || 0,
          change: summary.discountsChange || 0,
          prefix: currencySymbol,
        },
        discountRate: {
          label: "Discount Rate",
          value: summary.discountRate || 0,
          change: summary.discountRateChange || 0,
          suffix: "%",
          decimal: 1,
        },
        grossProfit: {
          label: "Gross Profit",
          value: summary.grossProfit || 0,
          change: summary.grossProfitChange || 0,
          prefix: currencySymbol,
        },
        grossProfitMargin: {
          label: "Gross Margin",
          value: summary.grossProfitMargin || 0,
          change: summary.grossProfitMarginChange || 0,
          suffix: "%",
          decimal: 1,
        },
        contributionMargin: {
          label: "Contribution Margin",
          value: summary.contributionMargin || 0,
          change: summary.contributionMarginChange || 0,
          prefix: currencySymbol,
        },
        contributionMarginPercentage: {
          label: "Contribution %",
          value: summary.contributionMarginPercentage || 0,
          change: summary.contributionMarginPercentageChange || 0,
          suffix: "%",
          decimal: 1,
        },
        operatingMargin: {
          label: "Operating Margin",
          value: 0, // Still calculated elsewhere
          suffix: "%",
          decimal: 1,
        },
        // Marketing Analytics
        totalAdSpend: {
          label: "Total Ad Spend",
          value: summary.adSpend || 0,
          change: summary.adSpendChange || 0,
          prefix: currencySymbol,
        },
        metaAdSpend: {
          label: "Meta Ad Spend",
          value: summary.metaAdSpend || 0,
          change: summary.metaAdSpendChange || 0,
          prefix: currencySymbol,
        },
        metaSpendPercentage: {
          label: "Meta % of Ad Spend",
          value: summary.metaSpendPercentage || 0,
          suffix: "%",
          decimal: 1,
        },
        marketingPercentageOfGross: {
          label: "Marketing % of Gross",
          value:
            summary.grossSales > 0
              ? (summary.adSpend / summary.grossSales) * 100
              : 0,
          suffix: "%",
          decimal: 1,
        },
        marketingPercentageOfNet: {
          label: "Marketing % of Revenue",
          value:
            summary.revenue > 0 ? (summary.adSpend / summary.revenue) * 100 : 0,
          suffix: "%",
          decimal: 1,
        },
        metaROAS: {
          label: "Meta ROAS",
          value: summary.metaROAS || 0,
          change: summary.metaROASChange || 0,
          decimal: 2,
        },

        // Cost Structure
        cogs: {
          label: "COGS",
          value: summary.cogs || 0,
          change: summary.cogsChange || 0,
          prefix: currencySymbol,
        },
        cogsPercentageOfGross: {
          label: "COGS % of Gross",
          value:
            summary.grossSales > 0
              ? (summary.cogs / summary.grossSales) * 100
              : 0,
          suffix: "%",
          decimal: 1,
        },
        cogsPercentageOfNet: {
          label: "COGS % of Revenue",
          value:
            summary.revenue > 0 ? (summary.cogs / summary.revenue) * 100 : 0,
          suffix: "%",
          decimal: 1,
        },
        shippingCosts: {
          label: "Shipping Costs",
          value: summary.shippingCosts || 0,
          change: summary.shippingCostsChange || 0,
          prefix: currencySymbol,
        },
        shippingPercentageOfGross: {
          label: "Shipping % of Gross",
          value:
            summary.grossSales > 0
              ? (summary.shippingCosts / summary.grossSales) * 100
              : 0,
          suffix: "%",
          decimal: 1,
        },
        shippingPercentageOfNet: {
          label: "Shipping % of Revenue",
          value:
            summary.revenue > 0
              ? (summary.shippingCosts / summary.revenue) * 100
              : 0,
          suffix: "%",
          decimal: 1,
        },
        transactionFees: {
          label: "Transaction Fees",
          value: summary.transactionFees || 0,
          change: summary.transactionFeesChange || 0,
          prefix: currencySymbol,
        },
        transactionFeesPercentage: {
          label: "Fees % of Revenue",
          value:
            summary.revenue > 0
              ? (summary.transactionFees / summary.revenue) * 100
              : 0,
          suffix: "%",
          decimal: 1,
        },
        taxesCollected: {
          label: "Taxes Collected",
          value: summary.taxesCollected || 0,
          change: summary.taxesCollectedChange || 0,
          prefix: currencySymbol,
        },
        taxesPercentageOfRevenue: {
          label: "Taxes % of Revenue",
          value:
            summary.revenue > 0
              ? (summary.taxesCollected / summary.revenue) * 100
              : 0,
          suffix: "%",
          decimal: 1,
        },
        handlingFees: {
          label: "Handling Fees",
          value: 0, // TODO: Get from costs data
          change: 0,
          prefix: currencySymbol,
        },
        customCosts: {
          label: "Custom Costs",
          value: 0, // TODO: Get from costs data
          change: 0,
          prefix: currencySymbol,
        },
        taxesPaid: {
          label: "Taxes Paid",
          value: 0, // TODO: Get from costs data
          change: 0,
          prefix: currencySymbol,
        },
        operatingCosts: {
          label: "Operating Costs",
          value: 0, // TODO: Get from costs data
          change: 0,
          prefix: currencySymbol,
        },

        // Customer Economics
        totalCustomers: {
          label: "Total Customers",
          value: summary.customers || 0,
          change: summary.customersChange || 0,
        },
        newCustomers: {
          label: "New Customers",
          value: summary.newCustomers || 0,
          change: summary.newCustomersChange || 0,
        },
        returningCustomers: {
          label: "Returning Customers",
          value: summary.returningCustomers || 0,
          change: summary.returningCustomersChange || 0,
        },
        repeatCustomerRate: {
          label: "Repeat Rate",
          value:
            summary.customers > 0
              ? (summary.returningCustomers / summary.customers) * 100
              : 0,
          change: 0, // TODO: Calculate proper change
          suffix: "%",
          decimal: 1,
        },
        customerAcquisitionCost: {
          label: "CAC",
          value:
            summary.newCustomers > 0
              ? summary.adSpend / summary.newCustomers
              : 0,
          change: 0, // TODO: Calculate proper change
          prefix: currencySymbol,
          decimal: 2,
        },
        cacPercentageOfAOV: {
          label: "CAC % of AOV",
          value:
            summary.avgOrderValue > 0 && summary.newCustomers > 0
              ? (summary.adSpend /
                  summary.newCustomers /
                  summary.avgOrderValue) *
                100
              : 0,
          suffix: "%",
          decimal: 1,
        },

        // Unit Economics
        unitsSold: {
          label: "Units Sold",
          value: summary.unitsSold || 0,
          change: summary.unitsSoldChange || 0,
        },
        avgOrderProfit: {
          label: "Avg Order Profit",
          value: summary.orders > 0 ? summary.profit / summary.orders : 0,
          change: 0, // TODO: Calculate proper change
          prefix: currencySymbol,
          decimal: 2,
        },
        profitPerOrder: {
          label: "Profit/Order",
          value: summary.orders > 0 ? summary.profit / summary.orders : 0,
          prefix: currencySymbol,
          decimal: 2,
        },
        profitPerUnit: {
          label: "Profit/Unit",
          value: summary.unitsSold > 0 ? summary.profit / summary.unitsSold : 0,
          prefix: currencySymbol,
          decimal: 2,
        },
      }
    : null;

  return {
    metrics,
    isLoading,
    isSyncing,
    isCalculating,
    syncStatus,
    isInitialSyncComplete: integrationStatus.isInitialSyncComplete,
  };
}

// ============ DASHBOARD SUMMARY ============

/**
 * Get dashboard summary for time range
 */
export function useDashboardSummary(
  timeRange?: "today" | "7d" | "30d" | "90d"
) {
  const summary = useQuery(api.web.dashboard.getDashboardSummary, {
    timeRange: timeRange || "30d",
  });
  const loading = summary === undefined;
  const error =
    summary === null && !loading ? "Failed to load dashboard summary" : null;

  return {
    summary,
    loading,
    error,
    metrics: summary
      ? {
          revenue: summary.revenue || 0,
          profit: summary.profit || 0,
          orders: summary.orders || 0,
          customers: summary.customers || 0,
          products: summary.products || 0,
          adSpend: summary.adSpend || 0,
          profitMargin: summary.profitMargin || 0,
          avgOrderValue: summary.avgOrderValue || 0,
          roas: summary.roas || 0,
        }
      : null,
    period: summary?.period,
  };
}

// ============ ANALYTICS METRICS ============

/**
 * Get analytics metrics for date range
 */
export function useAnalyticsMetrics(params: {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics?: string[];
  granularity?: "daily" | "weekly" | "monthly";
}) {
  const { timezone } = useOrganizationTimeZone();
  const metrics = useQuery(api.web.analytics.getMetrics, {
    ...params,
    dateRange: toUtcRangeStrings(params.dateRange, timezone),
  });
  const loading = metrics === undefined;
  const error = metrics === null && !loading ? "Failed to load metrics" : null;

  return {
    metrics: metrics || [],
    loading,
    error,
    hasMetrics: (metrics && metrics.length > 0) ?? false,
  };
}

export function useChannelPerformance(params?: {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  channels?: string[];
}) {
  const { timezone } = useOrganizationTimeZone();
  const performance = useQuery(
    api.web.analytics.getChannelRevenue,
    params?.dateRange
      ? {
          dateRange: toUtcRangeStrings(params.dateRange, timezone),
        }
      : "skip",
  );
  const loading = performance === undefined;
  const error =
    performance === null && !loading
      ? "Failed to load channel performance"
      : null;
  const filteredChannels = performance?.channels?.filter((channel) =>
    params?.channels?.length ? params.channels.includes(channel.name) : true,
  );

  return {
    performance: filteredChannels || [],
    totalRevenue: performance?.totalRevenue ?? 0,
    timeSeries: performance?.timeSeries ?? [],
    loading,
    error,
    hasData: (filteredChannels && filteredChannels.length > 0) ?? false,
  };
}

/**
 * Get product performance metrics
 */
export function useProductPerformance(params?: {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  productIds?: string[];
  limit?: number;
}) {
  const { timezone } = useOrganizationTimeZone();
  const performance = useQuery(
    api.web.analytics.getProductPerformance,
    (params
      ? {
          ...params,
          ...(params.dateRange && {
            dateRange: toUtcRangeStrings(params.dateRange, timezone),
          }),
        }
      : "skip") as any
  );
  const loading = performance === undefined;
  const error =
    performance === null && !loading
      ? "Failed to load product performance"
      : null;

  return {
    performance: performance || [],
    loading,
    error,
    hasData: (performance && performance.length > 0) ?? false,
  };
}

// Legacy customer analytics hook removed; use hooks/mainapp/useCustomerAnalytics instead.

// ============ TRENDING DATA ============

/**
 * Get trending metrics
 */
export function useTrendingMetrics(params?: {
  metric: "revenue" | "orders" | "customers" | "profit";
  timeframe: "24h" | "7d" | "30d";
  comparison?: boolean;
}) {
  const trending = useQuery(
    api.web.dashboard.getTrendingMetrics,
    params ? params : "skip"
  );
  const loading = trending === undefined;
  const error =
    trending === null && !loading ? "Failed to load trending data" : null;

  return {
    trending,
    loading,
    error,
    hasData: !!trending,
    trend: trending
      ? {
          value: trending.value || 0,
          change: trending.change || 0,
          changePercent: trending.changePercent || 0,
          direction: trending.direction || "neutral",
        }
      : null,
  };
}

// ============ ACTIVITY FEED ============

/**
 * Get recent activity feed
 */
export function useActivityFeed(limit?: number) {
  const activity = useQuery(api.web.dashboard.getActivityFeed, {
    limit: limit || 10,
  });
  const loading = activity === undefined;
  const error =
    activity === null && !loading ? "Failed to load activity feed" : null;

  return {
    activity: activity || [],
    loading,
    error,
    hasActivity: (activity && activity.length > 0) ?? false,
  };
}

// ============ REAL-TIME METRICS ============

/**
 * Get real-time metrics
 */
export function useRealTimeMetrics() {
  const metrics = useQuery(api.web.analytics.getRealTimeMetrics);
  const loading = metrics === undefined;
  const error =
    metrics === null && !loading ? "Failed to load real-time metrics" : null;

  return {
    metrics,
    loading,
    error,
    realTime: metrics
      ? {
          revenue: metrics.revenue || 0,
          orders: metrics.orders || 0,
          visitors: metrics.visitors || 0,
          conversions: metrics.conversions || 0,
          lastUpdated: metrics.lastUpdated,
        }
      : null,
  };
}

// ============ FINANCIAL OVERVIEW ============

/**
 * Get profit & loss overview
 */
export function useProfitLossOverview(params?: {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  granularity?: "daily" | "weekly" | "monthly";
}) {
  const { timezone } = useOrganizationTimeZone();
  const pnl = useQuery(
    api.web.analytics.getProfitLossOverview,
    (params
      ? {
          ...params,
          ...(params.dateRange && {
            dateRange: toUtcRangeStrings(params.dateRange, timezone),
          }),
        }
      : "skip") as any
  );
  const loading = pnl === undefined;
  const error = pnl === null && !loading ? "Failed to load P&L data" : null;

  return {
    pnl,
    loading,
    error,
    financials: pnl
      ? {
          revenue: pnl.revenue || 0,
          cogs: pnl.cogs || 0,
          grossProfit: pnl.grossProfit || 0,
          expenses: pnl.expenses || 0,
          netProfit: pnl.netProfit || 0,
          grossMargin: pnl.grossMargin || 0,
          netMargin: pnl.netMargin || 0,
        }
      : null,
  };
}

// ============ COHORT ANALYSIS ============

/**
 * Get cohort analysis data
 */
export function useCohortAnalysis(params?: {
  startDate?: string;
  endDate?: string;
  cohortType?: "monthly" | "weekly";
}) {
  const { timezone } = useOrganizationTimeZone();
  const cohorts = useQuery(
    api.web.analytics.getCohortAnalysis,
    (params && params.startDate && params.endDate
      ? {
          ...params,
          ...toUtcRangeStrings(
            {
              startDate: params.startDate,
              endDate: params.endDate,
            },
            timezone
          ),
        }
      : params || "skip") as any
  );
  const loading = cohorts === undefined;
  const error =
    cohorts === null && !loading ? "Failed to load cohort data" : null;

  return {
    cohorts: cohorts || [],
    loading,
    error,
    hasData: (cohorts && cohorts.length > 0) ?? false,
  };
}
