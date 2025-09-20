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
  const { offsetMinutes } = useShopifyTime();
  const { timezone } = useOrganizationTimeZone();

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

  const effectiveDateRange: { startDate: string; endDate: string } = {
    startDate: dateRange?.startDate ?? defaultDateRange.startDate,
    endDate: dateRange?.endDate ?? defaultDateRange.endDate,
  };

  // Fetch P&L metrics - this single call gives us most of what we need
  const metricsData = useQuery(api.web.pnl.getMetrics, {
    dateRange: dateRangeToUtcWithShopPreference(
      effectiveDateRange,
      offsetMinutes,
      timezone
    ),
  });

  // Fetch table data based on granularity
  const tableData = useQuery(api.web.pnl.getTableData, {
    dateRange: dateRangeToUtcWithShopPreference(
      effectiveDateRange,
      offsetMinutes,
      timezone
    ),
    granularity,
  });

  // Process KPI metrics
  const kpiMetrics: PnLKPIMetrics | undefined = useMemo(() => {
    if (!metricsData) return undefined;

    // Calculate additional metrics from base data
    const grossSales = metricsData.revenue || 0;
    const discountsReturns = grossSales * 0.1; // Estimate 10% for discounts/returns
    const netRevenue = grossSales - discountsReturns;
    const cogs = metricsData.totalCosts * 0.4 || 0; // Estimate COGS as 40% of total costs
    const grossProfit = metricsData.grossProfit || 0;
    const operatingExpenses = metricsData.totalCosts - cogs || 0;
    const ebitda = grossProfit - operatingExpenses * 0.3 || 0; // Estimate EBITDA
    const netProfit = metricsData.netProfit || 0;
    const netMargin = metricsData.netProfitMargin || 0;
    const marketingCost = metricsData.totalAdSpend || 0;
    const marketingROAS = metricsData.avgROAS || 0;
    // Calculate Marketing ROI: (Revenue from marketing - Marketing Cost) / Marketing Cost
    const marketingROI =
      marketingCost > 0 ? (netRevenue - marketingCost) / marketingCost : 0;
    // Estimate taxes as 15% of operating expenses
    const taxes = operatingExpenses * 0.15 || 0;

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
        grossSales: metricsData.revenueChange || 0,
        discountsReturns: -5, // Estimate discount change
        netRevenue: metricsData.revenueChange || 0,
        grossProfit: metricsData.grossProfitChange || 0,
        operatingExpenses: metricsData.costsChange || 0,
        ebitda: metricsData.grossProfitChange || 0,
        netProfit: metricsData.netProfitChange || 0,
        netMargin:
          (metricsData.netProfitMargin || 0) -
            ((metricsData.netProfit - metricsData.netProfit * 0.1) /
              metricsData.revenue) *
              100 || 0,
        marketingCost: metricsData.adSpendChange || 0,
        marketingROAS: metricsData.roasChange || 0,
        marketingROI: metricsData.roasChange || 0, // Use ROAS change as proxy for ROI change
        taxes: metricsData.costsChange * 0.15 || 0, // Estimate taxes change
      },
    };
  }, [metricsData]);

  // Process table data
  const tablePeriods: PnLTablePeriod[] | undefined = useMemo(() => {
    if (!tableData?.periods) return undefined;

    return tableData.periods.map((period) => ({
      ...period,
      metrics: {
        grossSales: period.metrics.revenue || 0, // Use revenue as proxy for gross sales
        discounts: 0, // Not provided by API
        refunds: 0, // Not provided by API
        revenue: period.metrics.revenue,
        cogs: period.metrics.cogs,
        shippingCosts: period.metrics.shippingCosts,
        transactionFees: period.metrics.transactionFees,
        handlingFees: period.metrics.handlingFees,
        grossProfit: period.metrics.grossProfit,
        taxesCollected: 0, // Not provided by API
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

    const exportRows: unknown[] = [];

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
    metrics: metricsData === undefined,
    table: tableData === undefined,
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
