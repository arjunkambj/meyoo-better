"use client";

import { Card, Skeleton, Tab, Tabs } from "@heroui/react";
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
  setGranularity?: (granularity: PnLGranularity) => void;
  loading?: boolean;
}

// Enhanced metric configuration with vibrant colors
const metricConfig: Record<keyof PnLMetrics, {
  label: string;
  icon?: string;
  iconColor?: string;
  category: 'revenue' | 'cogs' | 'operations' | 'profit';
  isSection?: boolean;
  isBold?: boolean;
}> = {
  grossSales: {
    label: "Gross Sales",
    icon: "solar:sale-bold-duotone",
    iconColor: "text-primary",
    category: 'revenue',
    isSection: true
  },
  discounts: {
    label: "Discounts",
    icon: "solar:tag-price-bold-duotone",
    iconColor: "text-default-500",
    category: 'revenue'
  },
  refunds: {
    label: "Returns",
    icon: "solar:rewind-back-bold-duotone",
    iconColor: "text-default-500",
    category: 'revenue'
  },
  revenue: {
    label: "Net Revenue",
    icon: "solar:wallet-2-bold-duotone",
    iconColor: "text-success",
    category: 'revenue',
    isBold: true
  },
  cogs: {
    label: "Cost of Goods Sold",
    icon: "solar:box-bold-duotone",
    iconColor: "text-warning",
    category: 'cogs',
    isSection: true
  },
  shippingCosts: {
    label: "Shipping",
    icon: "solar:delivery-bold-duotone",
    iconColor: "text-warning",
    category: 'cogs'
  },
  transactionFees: {
    label: "Transaction Fees",
    icon: "solar:card-transfer-bold-duotone",
    iconColor: "text-warning",
    category: 'cogs'
  },
  handlingFees: {
    label: "Handling",
    icon: "solar:hand-money-bold-duotone",
    iconColor: "text-warning",
    category: 'cogs'
  },
  grossProfit: {
    label: "Gross Profit",
    icon: "solar:chart-2-bold-duotone",
    iconColor: "text-secondary",
    category: 'profit',
    isBold: true
  },
  taxesCollected: {
    label: "Taxes Collected",
    icon: "solar:document-text-bold-duotone",
    iconColor: "text-default-600",
    category: 'operations',
    isSection: true
  },
  taxesPaid: {
    label: "Taxes Paid",
    icon: "solar:bill-check-bold-duotone",
    iconColor: "text-default-600",
    category: 'operations'
  },
  customCosts: {
    label: "Custom Costs",
    icon: "solar:settings-bold-duotone",
    iconColor: "text-default-600",
    category: 'operations'
  },
  totalAdSpend: {
    label: "Marketing Spend",
    icon: "solar:megaphone-bold-duotone",
    iconColor: "text-warning",
    category: 'operations'
  },
  netProfit: {
    label: "Net Profit",
    icon: "solar:safe-square-bold-duotone",
    iconColor: "text-success",
    category: 'profit',
    isBold: true
  },
  netProfitMargin: {
    label: "Net Margin %",
    icon: "solar:pie-chart-2-bold-duotone",
    iconColor: "text-primary",
    category: 'profit',
    isBold: true
  },
};

export const PnLTable = React.memo(function PnLTable({
  periods,
  granularity,
  setGranularity,
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

  // Build clean HTML table
  const tableContent = useMemo(() => {
    if (!periods || periods.length === 0) return null;

    // Separate regular periods from total
    let regularPeriods = periods.filter((p) => !p.isTotal);
    const totalPeriod = periods.find((p) => p.isTotal);

    // Limit daily view to 5 days for better fit
    if (granularity === "daily" && regularPeriods.length > 5) {
      regularPeriods = regularPeriods.slice(-5);
    }

    // Format period labels more compactly
    const formatPeriodLabel = (period: PnLTablePeriod) => {
      if (granularity === "weekly" && period.date) {
        const date = new Date(period.date);
        return `Week ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      }
      if (granularity === "daily") {
        const date = new Date(period.date || period.label);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      return period.label;
    };

    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-divider">
              <th className="text-left py-3 px-4 font-semibold text-default-900 sticky left-0 bg-background min-w-[180px] z-10">
                Metric
              </th>
              {regularPeriods.map((period) => (
                <th
                  key={period.label}
                  className="text-right py-3 px-3 font-medium text-sm text-default-700 min-w-[100px] border-r border-default-100"
                >
                  {formatPeriodLabel(period)}
                </th>
              ))}
              {totalPeriod && (
                <th className="text-right py-3 px-3 font-semibold text-sm text-foreground bg-default-100 min-w-[100px] border-l-2 border-divider">
                  TOTAL
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(metricConfig).map(([metricKey, config]) => {
              const isPercentage = metricKey === "netProfitMargin";
              const shouldAddParentheses = isDeduction(metricKey as keyof PnLMetrics);

              // Add section separators
              const isNewSection = config.isSection;
              const isBoldRow = config.isBold;

              return (
                <tr
                  key={metricKey}
                  className={`
                    border-b border-default-100
                    hover:bg-default-50/50 transition-colors
                    ${isNewSection ? "border-t-2 border-divider" : ""}
                    ${isBoldRow ? "bg-default-50/30" : ""}
                  `}
                >
                  <td className="py-3 px-4 sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-2">
                      {config.icon && (
                        <Icon
                          icon={config.icon}
                          width={16}
                          className={config.iconColor || "text-default-500"}
                        />
                      )}
                      <span className={`text-sm ${isBoldRow ? "font-semibold text-foreground" : "text-default-800"}`}>
                        {config.label}
                      </span>
                    </div>
                  </td>
                  {regularPeriods.map((period) => {
                    const value = period.metrics[metricKey as keyof PnLMetrics];
                    const textColor =
                      metricKey === "netProfit" || metricKey === "grossProfit"
                        ? value < 0 ? "text-danger" : "text-success"
                        : metricKey === "revenue"
                          ? "text-primary"
                        : shouldAddParentheses
                          ? "text-default-600"
                          : "text-default-900";

                    return (
                      <td
                        key={period.label}
                        className="text-right py-3 px-3 border-r border-default-100"
                      >
                        <span className={`
                          text-sm
                          ${textColor}
                          ${isBoldRow ? "font-semibold" : ""}
                        `}>
                          {formatValue(value, isPercentage, shouldAddParentheses)}
                        </span>
                      </td>
                    );
                  })}
                  {totalPeriod && (
                    <td className="text-right py-3 px-3 bg-default-100 border-l-2 border-divider">
                      <span className={`
                        text-sm font-bold
                        ${metricKey === "netProfit" || metricKey === "grossProfit"
                          ? totalPeriod.metrics[metricKey as keyof PnLMetrics] < 0
                            ? "text-danger"
                            : "text-success"
                          : metricKey === "revenue"
                            ? "text-primary"
                            : "text-foreground"
                        }
                      `}>
                        {formatValue(
                          totalPeriod.metrics[metricKey as keyof PnLMetrics],
                          isPercentage,
                          shouldAddParentheses
                        )}
                      </span>
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
    granularity,
    isDeduction,
  ]);

  // Calculate enhanced summary metrics
  const summaryMetrics = useMemo(() => {
    if (!periods || periods.length === 0) return null;

    const totalPeriod = periods.find((p) => p.isTotal);
    if (!totalPeriod) return null;

    const { metrics } = totalPeriod;

    // Calculate ROAS (Return on Ad Spend)
    const roas = metrics.totalAdSpend > 0
      ? metrics.revenue / metrics.totalAdSpend
      : 0;

    // Calculate gross margin
    const grossMargin = metrics.revenue > 0
      ? (metrics.grossProfit / metrics.revenue) * 100
      : 0;

    return {
      totalRevenue: metrics.revenue,
      totalProfit: metrics.netProfit,
      avgMargin: metrics.netProfitMargin,
      totalAdSpend: metrics.totalAdSpend,
      roas,
      grossMargin,
      totalCosts: metrics.cogs + metrics.shippingCosts + metrics.transactionFees + metrics.handlingFees,
    };
  }, [periods]);

  return (
    <Card className="bg-content2 dark:bg-content1 rounded-xl border border-default-200/50" shadow="none">
      {/* Header with integrated granularity tabs */}
      <div className="px-6 py-4 border-b border-divider bg-gradient-to-r from-background/50 to-background/30">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Profit & Loss Statement</h3>
          {setGranularity && (
            <Tabs
              aria-label="P&L granularity"
              size="sm"
              radius="lg"
              color="primary"
              selectedKey={granularity}
              variant="light"
              onSelectionChange={(key) => setGranularity(key as PnLGranularity)}
            >
              <Tab key="monthly" title="Monthly" />
              <Tab key="weekly" title="Weekly" />
              <Tab key="daily" title="Daily" />
            </Tabs>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-4">
          <Skeleton className="w-full h-10 rounded mb-3" />
          <Skeleton className="w-full h-64 rounded" />
        </div>
      ) : periods && periods.length > 0 ? (
        <>
          {/* Summary metrics bar */}
          {summaryMetrics && (
            <div className="mx-6 my-4 flex items-center divide-x divide-divider px-3 py-3 bg-default-100 dark:bg-default-50 rounded-lg text-sm">
              <div className="flex items-center gap-1.5 px-3 first:pl-2">
                <span className="text-default-600">Revenue:</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(summaryMetrics.totalRevenue, primaryCurrency)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3">
                <span className="text-default-600">Profit:</span>
                <span
                  className={`font-semibold ${
                    summaryMetrics.totalProfit > 0
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {formatCurrency(summaryMetrics.totalProfit, primaryCurrency)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3">
                <span className="text-default-600">Margin:</span>
                <span className="font-semibold text-secondary">
                  {summaryMetrics.avgMargin.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 last:pr-2">
                <span className="text-default-600">ROAS:</span>
                <span className="font-semibold text-warning">
                  {summaryMetrics.roas.toFixed(1)}x
                </span>
              </div>
            </div>
          )}

          {/* Table Content */}
          <div className="px-6 pb-6">
            {tableContent}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="p-4 bg-default-100 rounded-full mb-4">
            <Icon
              className="text-default-400"
              icon="solar:chart-square-line-duotone"
              width={48}
            />
          </div>
          <p className="text-base font-medium text-default-600 mb-1">
            No P&L data available
          </p>
          <p className="text-sm text-default-400">
            Select a different date range to view financial data
          </p>
        </div>
      )}
    </Card>
  );
});
