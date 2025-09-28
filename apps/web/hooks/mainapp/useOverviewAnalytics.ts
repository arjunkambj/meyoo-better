import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { getCurrencySymbol } from "@/libs/utils/format";
import { computeOverviewMetrics } from "@/libs/analytics/aggregations";
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
  const summaryResponse = useQuery(api.web.dashboard.getDashboardSummary, {
    timeRange, // Will be "30d" or undefined based on dateRange
    ...(dateRange && toUtcRangeStrings(dateRange, timezone)),
  });

  const overviewComputation = useMemo(
    () => computeOverviewMetrics(summaryResponse ?? undefined),
    [summaryResponse],
  );

  const summary = overviewComputation?.summary;
  const extras = overviewComputation?.extras;

  // Get analytics metrics if date range is provided
  // const _analyticsMetrics = useQuery(
  //   api.web.analytics.getMetrics,
  //   dateRange ? { dateRange, granularity: "daily" as const } : "skip",
  // );

  // Get real-time metrics
  const realTimeMetrics = useQuery(api.web.analytics.getRealTimeMetrics);

  // Get sync sessions for monitoring
  const syncSessions = useQuery(api.web.sync.getActiveSyncSessions);

  const isLoading = summaryResponse === undefined;
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
    ? (() => {
        const summaryWithExtras = {
          ...summary,
          blendedSessionConversionRate:
            extras?.blendedSessionConversionRate ?? 0,
          blendedSessionConversionRateChange:
            extras?.blendedSessionConversionRateChange ?? 0,
          uniqueVisitors: extras?.uniqueVisitors ?? 0,
        } as const;

        return {
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
        poas: {
          label: "POAS",
          value: summary.poas || 0,
          change: summary.poasChange || 0,
          decimal: 2,
        },
        ncROAS: {
          label: "ncROAS",
          value: summary.ncROAS || 0,
          change: summary.ncROASChange || 0,
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
          value: summary.operatingMargin || 0,
          change: summary.operatingMarginChange || 0,
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
        googleAdSpend: {
          label: "Google Ad Spend",
          value: summary.googleAdSpend || 0,
          change: summary.googleAdSpendChange || 0,
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
          value: summary.marketingPercentageOfGross || 0,
          change: summary.marketingPercentageOfGrossChange || 0,
          suffix: "%",
          decimal: 1,
        },
        marketingPercentageOfNet: {
          label: "Marketing % of Revenue",
          value: summary.marketingPercentageOfNet || 0,
          change: summary.marketingPercentageOfNetChange || 0,
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
        shippingPercentageOfNet: {
          label: "Shipping % of Revenue",
          value: summary.shippingPercentageOfNet || 0,
          change: summary.shippingPercentageOfNetChange || 0,
          suffix: "%",
          decimal: 1,
        },
        transactionFees: {
          label: "Transaction Fees",
          value: summary.transactionFees || 0,
          change: summary.transactionFeesChange || 0,
          prefix: currencySymbol,
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
          value: summary.handlingFees || 0,
          change: summary.handlingFeesChange || 0,
          prefix: currencySymbol,
        },
        customCosts: {
          label: "Operating Costs",
          value: summary.customCosts || 0,
          change: summary.customCostsChange || 0,
          prefix: currencySymbol,
        },
        customCostsPercentage: {
          label: "Operating % of Revenue",
          value: summary.customCostsPercentage || 0,
          change: summary.customCostsChange || 0,
          suffix: "%",
          decimal: 1,
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
            summary.repeatCustomerRate ||
            (summary.customers > 0
              ? (summary.returningCustomers / summary.customers) * 100
              : 0),
          change: summary.repeatCustomerRateChange || 0,
          suffix: "%",
          decimal: 1,
        },
        customerAcquisitionCost: {
          label: "CAC",
          value:
            summary.customerAcquisitionCost ||
            (summary.newCustomers > 0
              ? summary.adSpend / summary.newCustomers
              : 0),
          change: summary.customerAcquisitionCostChange || 0,
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
        returnRate: {
          label: "Return Rate",
          value: summary.returnRate || 0,
          change: summary.returnRateChange || 0,
          suffix: "%",
          decimal: 1,
        },
        blendedSessionConversionRate: {
          label: "Overall Session Conversion",
          value: summaryWithExtras.blendedSessionConversionRate || 0,
          change: summaryWithExtras.blendedSessionConversionRateChange || 0,
          suffix: "%",
          decimal: 2,
        },

        // Unit Economics
        unitsSold: {
          label: "Units Sold",
          value: summary.unitsSold || 0,
          change: summary.unitsSoldChange || 0,
        },
        avgOrderProfit: {
          label: "Avg Order Profit",
          value: summary.avgOrderProfit ||
            (summary.orders > 0 ? summary.profit / summary.orders : 0),
          change: summary.avgOrderProfitChange || 0,
          prefix: currencySymbol,
          decimal: 2,
        },
        avgOrderCost: {
          label: "Avg Order Cost",
          value: summary.avgOrderCost ||
            (summary.orders > 0
              ? (summary.revenue - summary.profit) / summary.orders
              : 0),
          change: summary.avgOrderCostChange || 0,
          prefix: currencySymbol,
          decimal: 2,
        },
        adSpendPerOrder: {
          label: "Ad Spend / Order",
          value: summary.adSpendPerOrder ||
            (summary.orders > 0 ? summary.adSpend / summary.orders : 0),
          change: summary.adSpendPerOrderChange || 0,
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
        };
      })()
    : null;

  return {
    metrics,
    isLoading,
    isSyncing,
    isCalculating,
    syncStatus,
    isInitialSyncComplete: Boolean(integrationStatus?.isInitialSyncComplete),
  };
}
