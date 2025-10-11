import { useCallback, useMemo } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { getCurrencySymbol } from "@/libs/utils/format";
import type {
  ChannelRevenueBreakdown,
  OverviewComputation,
  PlatformMetrics,
} from "@repo/types";
import { DEFAULT_DASHBOARD_CONFIG, type DashboardConfig } from "@repo/types";

const EMPTY_PLATFORM_METRICS: PlatformMetrics = {
  shopifyConversionRate: 0,
  shopifyAbandonedCarts: 0,
  shopifyCheckoutRate: 0,
  metaSessions: 0,
  metaClicks: 0,
  metaConversion: 0,
  metaConversionRate: 0,
  metaImpressions: 0,
  metaCTR: 0,
  metaCPM: 0,
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
  blendedCPM: 0,
  blendedCPC: 0,
  blendedCTR: 0,
};

type DateRangeArgs = {
  startDate: string;
  endDate: string;
};

type OverviewMetricView = {
  value: number;
  change?: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  decimal?: number;
};
type OverviewMetricsView = Record<string, OverviewMetricView>;

type OverviewResponse = {
  dateRange: DateRangeArgs;
  organizationId: string;
  overview: OverviewComputation | null;
  platformMetrics?: PlatformMetrics | null;
  channelRevenue?: ChannelRevenueBreakdown | null;
  primaryCurrency?: string;
  dashboardConfig: DashboardConfig;
  meta?: Record<string, unknown>;
} | null;


function buildOverviewMetrics(
  overview: OverviewComputation | null,
  currencySymbol: string,
): OverviewMetricsView | null {
  if (!overview || !overview.summary) {
    return null;
  }

  const summary = overview.summary;
  const extras = overview.extras || {};
  const summaryWithExtras = {
    ...summary,
    blendedSessionConversionRate: extras?.blendedSessionConversionRate ?? 0,
    blendedSessionConversionRateChange: extras?.blendedSessionConversionRateChange ?? 0,
    uniqueVisitors: extras?.uniqueVisitors ?? 0,
  } as const;

  const metricMap = overview.metrics ?? {};

  return {
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
    prepaidRate: {
      label: "Prepaid Rate",
      value: metricMap.prepaidRate?.value ?? 0,
      change: metricMap.prepaidRate?.change ?? 0,
      suffix: "%",
      decimal: 1,
    },
    ncROAS: {
      label: "ncROAS",
      value: summary.ncROAS || 0,
      change: summary.ncROASChange || 0,
      decimal: 2,
    },
    moMRevenueGrowth: {
      label: "MoM Revenue Growth",
      value: summary.moMRevenueGrowth || 0,
      change: 0,
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
    rtoRevenueLost: {
      label: "RTO Revenue Lost",
      value: summary.rtoRevenueLost || 0,
      change: summary.rtoRevenueLostChange || 0,
      prefix: currencySymbol,
    },
    manualReturnRate: {
      label: "Manual Return Rate",
      value: summary.manualReturnRate || 0,
      change: summary.manualReturnRateChange || 0,
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
    blendedMarketingCost: {
      label: "Total Ad Spend",
      value: summary.blendedMarketingCost || 0,
      change: summary.blendedMarketingCostChange || 0,
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
      change: summary.customCostsPercentageChange || 0,
      suffix: "%",
      decimal: 1,
    },
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
    abandonedCustomers: {
      label: "Abandoned Customers",
      value: summary.abandonedCustomers || 0,
      change: summary.abandonedCustomersChange || 0,
    },
    abandonedRate: {
      label: "Abandoned Customer Rate",
      value: summary.abandonedRate || 0,
      change: summary.abandonedRateChange || 0,
      suffix: "%",
      decimal: 1,
    },
    customerAcquisitionCost: {
      label: "CAC",
      value:
        summary.customerAcquisitionCost ||
        (summary.newCustomers > 0
          ? summary.blendedMarketingCost / summary.newCustomers
          : 0),
      change: summary.customerAcquisitionCostChange || 0,
      prefix: currencySymbol,
      decimal: 2,
    },
    cacPercentageOfAOV: {
      label: "CAC % of AOV",
      value:
        summary.avgOrderValue > 0 && summary.newCustomers > 0
          ? (summary.blendedMarketingCost /
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
        (summary.orders > 0
          ? summary.blendedMarketingCost / summary.orders
          : 0),
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
}


export function useDashboardOverview(dateRange: DateRangeArgs) {
  const queryArgs = useMemo(() => ({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  }), [dateRange.endDate, dateRange.startDate]);

  const response = useQuery(api.web.dashboard.getOverviewData, queryArgs);
  const updateLayout = useMutation(api.core.dashboard.updateDashboardLayout);

  const isLoading = response === undefined;
  const data: OverviewResponse = response ?? null;

  const primaryCurrency = data?.primaryCurrency ?? "USD";
  const currencySymbol = getCurrencySymbol(primaryCurrency);
  const overviewMetrics = useMemo(() => buildOverviewMetrics(data?.overview ?? null, currencySymbol), [
    data?.overview,
    currencySymbol,
  ]);

  const platformMetrics = data?.platformMetrics ?? EMPTY_PLATFORM_METRICS;
  const channelRevenue = data?.channelRevenue ?? null;
  const dashboardConfig = data?.dashboardConfig ?? DEFAULT_DASHBOARD_CONFIG;
  const saveConfig = useCallback(
    async (config: DashboardConfig) => {
      try {
        await updateLayout(config);
        return true;
      } catch (error) {
        console.error("Failed to save dashboard layout:", error);
        return false;
      }
    },
    [updateLayout],
  );

  return {
    isLoading,
    data,
    overview: data?.overview ?? null,
    overviewMetrics,
    platformMetrics,
    channelRevenue,
    dashboardConfig,
    saveConfig,
    primaryCurrency,
    meta: data?.meta,
  };
}
