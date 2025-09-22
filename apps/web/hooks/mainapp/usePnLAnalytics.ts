import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo, useState } from "react";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import { useOrganizationTimeZone } from "./useUser";
import type { PnLKPIMetrics } from "@/components/dashboard/(analytics)/pnl/components/PnLKPICards";
import { api } from "@/libs/convexApi";

export type PnLGranularity = "daily" | "weekly" | "monthly";

export interface PnLMetrics {
  grossSales: number;
  discounts: number;
  refunds: number;
  revenue: number;
  cogs: number;
  shippingCosts: number;
  transactionFees: number;
  handlingFees: number;
  grossProfit: number;
  taxesCollected: number;
  taxesPaid: number;
  customCosts: number;
  totalAdSpend: number;
  netProfit: number;
  netProfitMargin: number;
}

export interface PnLTablePeriod {
  label: string;
  date: string;
  metrics: PnLMetrics;
  growth: {
    revenue: number;
    netProfit: number;
  } | null;
  isTotal?: boolean;
}

export function usePnLAnalytics(dateRange?: {
  startDate: string;
  endDate: string;
}) {
  const [granularity, setGranularity] = useState<PnLGranularity>("monthly");
  const { offsetMinutes, isLoading: isShopTimeLoading } = useShopifyTime();
  const { timezone, loading: isTimezoneLoading } = useOrganizationTimeZone();

  // Default date range: last 30 days
  const defaultDateRange = useMemo<{ startDate: string; endDate: string }>(() => {
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(startDate.getDate() - 30);

    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    };
  }, []);

  const startDate = dateRange?.startDate ?? defaultDateRange.startDate;
  const endDate = dateRange?.endDate ?? defaultDateRange.endDate;

  const canRunQueries = !isShopTimeLoading && !isTimezoneLoading;

  const utcDateRange = useMemo(() => {
    if (!canRunQueries) return undefined;

    return dateRangeToUtcWithShopPreference(
      { startDate, endDate },
      offsetMinutes,
      timezone
    );
  }, [canRunQueries, startDate, endDate, offsetMinutes, timezone]);

  // Fetch P&L metrics - this single call gives us most of what we need
  const metricsArgs = useMemo(
    () => (utcDateRange ? { dateRange: utcDateRange } : ("skip" as const)),
    [utcDateRange]
  );
  const metricsData = useQuery(api.web.pnl.getMetrics, metricsArgs);

  // Fetch table data based on granularity
  const tableArgs = useMemo(
    () =>
      utcDateRange
        ? {
            dateRange: utcDateRange,
            granularity,
          }
        : ("skip" as const),
    [utcDateRange, granularity]
  );
  const tableData = useQuery(api.web.pnl.getTableData, tableArgs);

  // Process KPI metrics
  const kpiMetrics: PnLKPIMetrics | undefined = useMemo(() => {
    if (!metricsData) return undefined;

    const grossSales = metricsData.grossSales ?? metricsData.revenue ?? 0;
    const netRevenue = metricsData.revenue ?? 0;
    const discountsReturns =
      (metricsData.discounts ?? 0) + (metricsData.refunds ?? 0);
    const grossProfit = metricsData.grossProfit ?? 0;
    const marketingCost = metricsData.totalAdSpend ?? 0;
    const marketingROAS = metricsData.avgROAS ?? 0;
    const taxes = metricsData.taxesPaid ?? 0;
    const inferredOperatingExpenses =
      (metricsData.shippingCosts ?? 0) +
      (metricsData.transactionFees ?? 0) +
      (metricsData.handlingFees ?? 0) +
      (metricsData.customCosts ?? 0) +
      taxes +
      marketingCost;
    const operatingExpenses =
      metricsData.operatingExpenses ?? inferredOperatingExpenses;
    const netProfit = metricsData.netProfit ?? 0;
    const netMargin = metricsData.netProfitMargin ?? 0;
    const ebitda = metricsData.ebitda ?? netProfit + taxes;
    const marketingROI =
      metricsData.marketingROI ??
      (marketingCost > 0
        ? ((netRevenue - marketingCost) / marketingCost) * 100
        : 0);

    return {
      grossSales,
      discountsReturns,
      netRevenue,
      grossProfit,
      operatingExpenses,
      ebitda,
      netProfit,
      netMargin,
      marketingCost,
      marketingROAS,
      marketingROI,
      taxes,
      changes: {
        grossSales: metricsData.grossSalesChange ?? metricsData.revenueChange ?? 0,
        discountsReturns:
          metricsData.discountsReturnsChange ?? metricsData.discountsChange ?? 0,
        netRevenue: metricsData.revenueChange ?? 0,
        grossProfit: metricsData.grossProfitChange ?? 0,
        operatingExpenses:
          metricsData.operatingExpensesChange ?? metricsData.costsChange ?? 0,
        ebitda: metricsData.ebitdaChange ?? metricsData.netProfitChange ?? 0,
        netProfit: metricsData.netProfitChange ?? 0,
        netMargin: metricsData.netProfitMarginChange ?? 0,
        marketingCost:
          metricsData.totalAdSpendChange ?? metricsData.adSpendChange ?? 0,
        marketingROAS: metricsData.roasChange ?? 0,
        marketingROI:
          metricsData.marketingROIChange ?? metricsData.roasChange ?? 0,
        taxes: metricsData.taxesPaidChange ?? 0,
      },
    };
  }, [metricsData]);

  // Process table data
  const tablePeriods: PnLTablePeriod[] | undefined = useMemo(() => {
    if (!tableData?.periods) return undefined;

    return tableData.periods.map((period): PnLTablePeriod => ({
      ...period,
      metrics: {
        grossSales: period.metrics.grossSales,
        discounts: period.metrics.discounts,
        refunds: period.metrics.refunds,
        revenue: period.metrics.revenue,
        cogs: period.metrics.cogs,
        shippingCosts: period.metrics.shippingCosts,
        transactionFees: period.metrics.transactionFees,
        handlingFees: period.metrics.handlingFees,
        grossProfit: period.metrics.grossProfit,
        taxesCollected: period.metrics.taxesCollected,
        taxesPaid: period.metrics.taxesPaid,
        customCosts: period.metrics.customCosts,
        totalAdSpend: period.metrics.totalAdSpend,
        netProfit: period.metrics.netProfit,
        netProfitMargin: period.metrics.netProfitMargin,
      },
    }));
  }, [tableData]);

  // Export data function
  const exportData = async () => {
    if (!kpiMetrics || !tablePeriods) return [];

    const exportRows: Record<string, unknown>[] = [];

    // Add KPI Metrics
    exportRows.push(
      {
        metric: "Gross Sales",
        value: kpiMetrics.grossSales,
        change: kpiMetrics.changes.grossSales,
      },
      {
        metric: "Discounts & Returns",
        value: kpiMetrics.discountsReturns,
        change: kpiMetrics.changes.discountsReturns,
      },
      {
        metric: "Net Revenue",
        value: kpiMetrics.netRevenue,
        change: kpiMetrics.changes.netRevenue,
      },
      {
        metric: "Gross Profit",
        value: kpiMetrics.grossProfit,
        change: kpiMetrics.changes.grossProfit,
      },
      {
        metric: "Operating Expenses",
        value: kpiMetrics.operatingExpenses,
        change: kpiMetrics.changes.operatingExpenses,
      },
      {
        metric: "EBITDA",
        value: kpiMetrics.ebitda,
        change: kpiMetrics.changes.ebitda,
      },
      {
        metric: "Net Profit",
        value: kpiMetrics.netProfit,
        change: kpiMetrics.changes.netProfit,
      },
      {
        metric: "Net Margin %",
        value: kpiMetrics.netMargin,
        change: kpiMetrics.changes.netMargin,
      }
    );

    // Add table data by period
    tablePeriods.forEach((period) => {
      if (!period.isTotal) {
        exportRows.push({
          period: period.label,
          grossSales: period.metrics.grossSales,
          discounts: period.metrics.discounts,
          refunds: period.metrics.refunds,
          revenue: period.metrics.revenue,
          cogs: period.metrics.cogs,
          shippingCosts: period.metrics.shippingCosts,
          transactionFees: period.metrics.transactionFees,
          handlingFees: period.metrics.handlingFees,
          grossProfit: period.metrics.grossProfit,
          taxesCollected: period.metrics.taxesCollected,
          taxesPaid: period.metrics.taxesPaid,
          customCosts: period.metrics.customCosts,
          totalAdSpend: period.metrics.totalAdSpend,
          netProfit: period.metrics.netProfit,
          netProfitMargin: period.metrics.netProfitMargin,
        });
      }
    });

    return exportRows;
  };

  // Granular loading states for each data type
  const loadingStates = {
    metrics: metricsData === undefined || !utcDateRange,
    table: tableData === undefined || !utcDateRange,
  };

  // Check if any data is loading (for backward compatibility)
  const isLoading = Object.values(loadingStates).some((loading) => loading);

  // Check if initial critical data is loading (metrics)
  const isInitialLoading = loadingStates.metrics;

  return {
    kpiMetrics,
    tablePeriods,
    granularity,
    setGranularity,
    isLoading,
    isInitialLoading,
    loadingStates,
    exportData,
  };
}
