"use client";

import { Card, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback, useMemo } from "react";
import {
  type PnLGranularity,
  type PnLMetrics,
  type PnLTablePeriod,
  useUser,
} from "@/hooks";
import { formatCurrency } from "@/libs/utils/format";

interface PnLTableProps {
  periods: PnLTablePeriod[] | undefined;
  granularity: PnLGranularity;
  loading?: boolean;
}

const metricLabels: Record<keyof PnLMetrics, string> = {
  grossSales: "Gross Sales",
  discounts: "Discounts",
  refunds: "Returns",
  revenue: "Net Revenue",
  cogs: "COGS",
  shippingCosts: "Shipping Costs",
  transactionFees: "Transaction Fees",
  handlingFees: "Handling Fees",
  grossProfit: "Gross Profit",
  taxesCollected: "Taxes Collected",
  taxesPaid: "Taxes Paid",
  customCosts: "Custom Costs",
  totalAdSpend: "Ad Spend",
  netProfit: "Net Profit",
  netProfitMargin: "Net Margin %",
};

export const PnLTable = React.memo(function PnLTable({
  periods,
  granularity,
  loading,
}: PnLTableProps) {
  const { primaryCurrency } = useUser();

  // Format value with currency or percentage
  const formatValue = useCallback(
    (value: number, isPercentage = false, addParentheses = false) => {
      if (isPercentage) {
        return `${value.toFixed(1)}%`;
      }

      const formatted = formatCurrency(value, primaryCurrency);

      // Add parentheses for negative values (costs/deductions)
      if (addParentheses && value !== 0) {
        return `(${formatted})`;
      }

      return formatted;
    },
    [primaryCurrency]
  );

  // Determine which metrics should show in parentheses (negative/deductions)
  const isDeduction = useCallback((metricKey: keyof PnLMetrics) => {
    return [
      "discounts",
      "refunds",
      "cogs",
      "shippingCosts",
      "transactionFees",
      "handlingFees",
      "taxesPaid",
      "customCosts",
      "totalAdSpend",
    ].includes(metricKey);
  }, []);

  // Get row styling based on metric type - simplified
  const getRowStyling = useCallback((metricKey: string) => {
    // Only bold for net profit to highlight the key metric
    if (metricKey === "netProfit" || metricKey === "netProfitMargin") {
      return "font-semibold";
    }

    return "";
  }, []);

  // Check if row should have extra spacing above it
  const hasExtraSpacing = useCallback((metricKey: string) => {
    return ["cogs", "grossProfit", "taxesCollected", "netProfit"].includes(
      metricKey
    );
  }, []);

  // Build table content
  const tableContent = useMemo(() => {
    if (!periods || periods.length === 0) return null;

    // Separate regular periods from total
    let regularPeriods = periods.filter((p) => !p.isTotal);
    const totalPeriod = periods.find((p) => p.isTotal);

    // For daily view, only show last 7 days
    if (granularity === "daily" && regularPeriods.length > 7) {
      regularPeriods = regularPeriods.slice(-7);
    }

    // Format period labels for better clarity
    const formatPeriodLabel = (period: PnLTablePeriod) => {
      if (granularity === "weekly" && period.date) {
        // Show week range for weekly view
        const startDate = new Date(period.date);
        const endDate = new Date(startDate);

        endDate.setDate(endDate.getDate() + 6);

        return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      }

      return period.label;
    };

    return (
      <div className="w-full  overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-divider">
              <th className="text-left p-2 text-sm font-semibold text-default-700 min-w-[160px]">
                Metric
              </th>
              {regularPeriods.map((period) => (
                <th
                  key={period.label}
                  className="text-right p-2 text-xs font-medium text-default-600 min-w-[100px]"
                >
                  {formatPeriodLabel(period)}
                </th>
              ))}
              {totalPeriod && (
                <th className="text-right p-2 text-sm font-bold text-default-800 min-w-[100px] bg-default-100">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(metricLabels).map(([metricKey, label]) => {
              const isPercentage = metricKey === "netProfitMargin";
              const shouldAddParentheses = isDeduction(
                metricKey as keyof PnLMetrics
              );
              const rowStyling = getRowStyling(metricKey);
              const hasSpacing = hasExtraSpacing(metricKey);

              return (
                <tr
                  key={metricKey}
                  className={`border-b border-default-200/50 transition-colors ${rowStyling} ${
                    hasSpacing ? "border-t-2 border-divider" : ""
                  }`}
                >
                  <td className="p-2">
                    <span className="text-sm font-medium text-default-700">
                      {label}
                    </span>
                  </td>
                  {regularPeriods.map((period) => {
                    const value = period.metrics[metricKey as keyof PnLMetrics];
                    // Simplified color scheme - only highlight net profit
                    const textColor =
                      metricKey === "netProfit"
                        ? value < 0
                          ? "text-danger-600"
                          : "text-success-600"
                        : shouldAddParentheses
                          ? "text-default-500"
                          : "text-default-700";

                    return (
                      <td
                        key={period.label}
                        className={`text-right p-2 text-sm ${textColor}`}
                      >
                        {formatValue(value, isPercentage, shouldAddParentheses)}
                      </td>
                    );
                  })}
                  {totalPeriod && (
                    <td
                      className={`text-right p-2 text-sm font-semibold bg-default-100 ${
                        metricKey === "netProfit"
                          ? totalPeriod.metrics[metricKey as keyof PnLMetrics] <
                            0
                            ? "text-danger-600"
                            : "text-success-600"
                          : "text-default-800"
                      }`}
                    >
                      {formatValue(
                        totalPeriod.metrics[metricKey as keyof PnLMetrics],
                        isPercentage,
                        shouldAddParentheses
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [
    periods,
    formatValue,
    getRowStyling,
    granularity,
    hasExtraSpacing,
    isDeduction,
  ]);

  // Calculate summary metrics - must be before any conditional returns
  const summaryMetrics = useMemo(() => {
    if (!periods || periods.length === 0) return null;

    const totalPeriod = periods.find((p) => p.isTotal);

    if (!totalPeriod) return null;

    const { metrics } = totalPeriod;

    return {
      totalRevenue: metrics.revenue,
      totalProfit: metrics.netProfit,
      avgMargin: metrics.netProfitMargin,
      totalAdSpend: metrics.totalAdSpend,
    };
  }, [periods]);

  return (
    <Card className="p-0 bg-transparent" shadow="none">
      <div className="px-2 pb-4">
        <h3 className="text-lg font-semibold">Profit & Loss Statement</h3>
      </div>

      {loading ? (
        <div className="px-2 pb-6">
          {/* Show skeleton for table content only */}
          <Skeleton className="w-full h-12 rounded-lg mb-4" />
          <Skeleton className="w-full h-96 rounded-lg" />
        </div>
      ) : periods && periods.length > 0 ? (
        <>
          {/* Clean Summary Metrics with Vertical Dividers */}
          {summaryMetrics && (
            <div className="mx-2 mb-4 flex items-center divide-x divide-divider p-3 bg-content2 dark:bg-content1 rounded-lg">
              <div className="flex items-center gap-2 px-4 first:pl-3">
                <span className="text-sm text-default-600">Revenue:</span>
                <span className="text-sm font-semibold text-default-800">
                  {formatCurrency(summaryMetrics.totalRevenue, primaryCurrency)}
                </span>
              </div>
              <div className="flex items-center gap-2 px-4">
                <span className="text-sm text-default-600">Profit:</span>
                <span
                  className={`text-sm font-semibold ${
                    summaryMetrics.totalProfit > 0
                      ? "text-success-600"
                      : "text-danger-600"
                  }`}
                >
                  {formatCurrency(summaryMetrics.totalProfit, primaryCurrency)}
                </span>
              </div>
              <div className="flex items-center gap-2 px-4">
                <span className="text-sm text-default-600">Margin:</span>
                <span className="text-sm font-semibold text-default-800">
                  {summaryMetrics.avgMargin.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 last:pr-3">
                <span className="text-sm text-default-600">Ad Spend:</span>
                <span className="text-sm font-semibold text-default-800">
                  {formatCurrency(summaryMetrics.totalAdSpend, primaryCurrency)}
                </span>
              </div>
            </div>
          )}

          {/* Table Content */}
          <div className=" px-2 pb-6">
            <div className="rounded-xl border border-divider bg-default-50 overflow-hidden">
              {tableContent}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <Icon
            className="text-default-300 mb-4"
            icon="solar:chart-square-line-duotone"
            width={64}
          />
          <p className="text-default-500 text-center">
            No P&L data available for the selected period
          </p>
          <p className="text-sm text-default-400 mt-1">
            Try selecting a different date range
          </p>
        </div>
      )}
    </Card>
  );
});
