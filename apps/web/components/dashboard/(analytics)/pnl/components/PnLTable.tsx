"use client";

import { Skeleton, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback, useMemo } from "react";
import { useUser } from "@/hooks";
import type { PnLGranularity, PnLMetrics, PnLTablePeriod } from "@repo/types";
import { formatCurrency } from "@/libs/utils/format";

interface PnLTableProps {
  periods: PnLTablePeriod[] | undefined;
  granularity: PnLGranularity;
  setGranularity?: (granularity: PnLGranularity) => void;
  loading?: boolean;
  dateRange: { startDate: string; endDate: string };
}

const buildZeroMetrics = (): PnLMetrics => ({
  grossSales: 0,
  discounts: 0,
  refunds: 0,
  revenue: 0,
  cogs: 0,
  shippingCosts: 0,
  transactionFees: 0,
  handlingFees: 0,
  grossProfit: 0,
  taxesCollected: 0,
  customCosts: 0,
  totalAdSpend: 0,
  netProfit: 0,
  netProfitMargin: 0,
});

const toUtcMidnight = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

const buildExpectedPeriods = (
  granularity: PnLGranularity,
  range: { startDate: string; endDate: string },
): Array<{ key: string; label: string; date: string }> => {
  const start = toUtcMidnight(range.startDate);
  const end = toUtcMidnight(range.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const definitions: Array<{ key: string; label: string; date: string }> = [];

  if (granularity === "daily") {
    const cursor = new Date(end);
    for (let index = 0; index < 7; index += 1) {
      if (cursor < start) break;
      const iso = formatISODate(cursor);
      definitions.push({ key: iso, label: iso, date: iso });
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  } else if (granularity === "weekly") {
    const cursor = new Date(end);
    const day = cursor.getUTCDay() || 7;
    if (day !== 1) {
      cursor.setUTCDate(cursor.getUTCDate() - day + 1);
    }

    for (let index = 0; index < 6; index += 1) {
      if (cursor < start) break;
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const startIso = formatISODate(weekStart);
      const endIso = formatISODate(weekEnd);
      definitions.push({
        key: startIso,
        label: `${startIso} – ${endIso}`,
        date: startIso,
      });
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    }
  } else {
    const cursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

    for (let index = 0; index < 2; index += 1) {
      if (cursor < start) break;
      const monthStartIso = formatISODate(cursor);
      const monthKey = monthStartIso.slice(0, 7);
      definitions.push({
        key: `${monthKey}-01`,
        label: monthKey,
        date: `${monthKey}-01`,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }
  }

  definitions.reverse();
  return definitions;
};

const createPlaceholderPeriod = ({ label, date }: { label: string; date: string }): PnLTablePeriod => ({
  label,
  date,
  metrics: buildZeroMetrics(),
  growth: null,
});

// Enhanced metric configuration with vibrant colors
const metricConfig: Record<
  keyof PnLMetrics,
  {
    label: string;
    icon?: string;
    iconColor?: string;
    category: "revenue" | "cogs" | "operations" | "profit";
    isSection?: boolean;
    isBold?: boolean;
    isSubItem?: boolean;
    hidden?: boolean;
  }
> = {
  grossSales: {
    label: "Gross Sales",
    icon: "solar:sale-bold-duotone",
    iconColor: "text-success",
    category: "revenue",
    isBold: true,
    hidden: true,
  },
  revenue: {
    label: "Net Revenue",
    icon: "solar:wallet-2-bold-duotone",
    iconColor: "text-success-600",
    category: "revenue",
    isBold: true,
  },
  discounts: {
    label: "Discounts",
    icon: "solar:tag-price-bold-duotone",
    iconColor: "text-default-500",
    category: "revenue",
    isSubItem: true,
  },
  refunds: {
    label: "Returns",
    icon: "solar:rewind-back-bold-duotone",
    iconColor: "text-default-500",
    category: "revenue",
    isSubItem: true,
  },
  cogs: {
    label: "Total COGS",
    icon: "solar:box-bold-duotone",
    iconColor: "text-danger",
    category: "cogs",
    isBold: true,
  },
  shippingCosts: {
    label: "Shipping",
    icon: "solar:delivery-bold-duotone",
    iconColor: "text-danger-400",
    category: "cogs",
    isSubItem: true,
  },
  transactionFees: {
    label: "Transaction Fees",
    icon: "solar:card-transfer-bold-duotone",
    iconColor: "text-danger-400",
    category: "cogs",
    isSubItem: true,
  },
  handlingFees: {
    label: "Handling",
    icon: "solar:hand-money-bold-duotone",
    iconColor: "text-danger-400",
    category: "cogs",
    isSubItem: true,
  },
  grossProfit: {
    label: "Gross Profit",
    icon: "solar:chart-2-bold-duotone",
    iconColor: "text-primary",
    category: "profit",
    isBold: true,
  },
  taxesCollected: {
    label: "Taxes Collected",
    icon: "solar:document-text-bold-duotone",
    iconColor: "text-warning",
    category: "operations",
    isSubItem: true,
  },
  customCosts: {
    label: "Operating Costs",
    icon: "solar:settings-bold-duotone",
    iconColor: "text-warning-400",
    category: "operations",
    isSubItem: true,
  },
  totalAdSpend: {
    label: "Marketing Spend",
    icon: "solar:megaphone-bold-duotone",
    iconColor: "text-warning-400",
    category: "operations",
    isSubItem: true,
  },
  netProfit: {
    label: "Net Profit",
    icon: "solar:safe-square-bold-duotone",
    iconColor: "text-success",
    category: "profit",
    isBold: true,
  },
  netProfitMargin: {
    label: "Net Margin %",
    icon: "solar:pie-chart-2-bold-duotone",
    iconColor: "text-success-600",
    category: "profit",
    isBold: true,
  },
};

export const PnLTable = React.memo(function PnLTable({
  periods,
  granularity,
  setGranularity,
  loading,
  dateRange,
}: PnLTableProps) {
  const { primaryCurrency } = useUser();

  // Format value with currency or percentage
  const formatValue = useCallback(
    (value: number, isPercentage = false, addParentheses = false) => {
      if (isPercentage) {
        // Format percentage with proper sign
        const sign = value < 0 ? "-" : "";
        return `${sign}${Math.abs(value).toFixed(1)}%`;
      }

      // Format currency with absolute value
      const absValue = Math.abs(value);
      const formatted = formatCurrency(absValue, primaryCurrency);

      // Add parentheses for negative values (costs/deductions)
      if (addParentheses && value !== 0) {
        return `(${formatted})`;
      }

      // For negative values not in parentheses, add minus sign
      if (value < 0 && !addParentheses) {
        return `-${formatted}`;
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
      "customCosts",
      "totalAdSpend",
    ].includes(metricKey);
  }, []);

  // Build clean HTML table
  const tableContent = useMemo(() => {
    if (!periods || periods.length === 0) return null;

    const totalPeriod = periods.find((period) => period.isTotal);
    const regularPeriods = periods.filter((period) => !period.isTotal);

    const expectedDefinitions = buildExpectedPeriods(granularity, dateRange);
    const periodMap = new Map(regularPeriods.map((period) => [period.date, period]));
    const displayPeriods = expectedDefinitions.length
      ? expectedDefinitions.map((definition) =>
          periodMap.get(definition.key) ?? createPlaceholderPeriod(definition),
        )
      : regularPeriods;

    const formatPeriodLabel = (period: PnLTablePeriod) => {
      if (granularity === 'weekly' && period.date) {
        const date = new Date(period.date);
        return `Week ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
      if (granularity === 'daily') {
        const date = new Date(period.date || period.label);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }
      return period.label;
    };

    const renderMetricRow = (
      metricKey: string,
      config: (typeof metricConfig)[keyof typeof metricConfig],
    ) => {
      const isPercentage = metricKey === 'netProfitMargin';
      const shouldAddParentheses = isDeduction(metricKey as keyof PnLMetrics);
      const isBoldRow = config.isBold;
      const isSubItem = config.isSubItem;

      return (
        <tr
          key={metricKey}
          className={`
            border-b border-divider
            transition-all duration-200
            ${isBoldRow ? "bg-content2 font-semibold" : ""}
            ${isSubItem ? "hover:bg-content2" : "hover:bg-content1"}
          `}
        >
          <td
            className={`
            py-2 sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.02)]
            ${isSubItem ? "pl-8 pr-3 bg-background" : "px-3 bg-background"}
          `}
          >
            <div className="flex items-center gap-2">
              {config.icon && (
                <Icon
                  icon={config.icon}
                  width={isSubItem ? 14 : 16}
                  className={config.iconColor || "text-default-500"}
                />
              )}
              <span
                className={`
                ${isBoldRow ? "text-sm font-semibold" : isSubItem ? "text-xs text-default-600" : "text-sm text-default-700"}
              `}
              >
                {config.label}
              </span>
            </div>
          </td>
          {displayPeriods.map((period) => {
            const value = period.metrics[metricKey as keyof PnLMetrics];
            const textColor =
              metricKey === "netProfit" || metricKey === "grossProfit"
                ? value < 0
                  ? "text-danger"
                  : "text-success"
                : metricKey === "revenue"
                  ? "text-primary"
                  : metricKey === "netProfitMargin"
                    ? value < 0
                      ? "text-danger"
                      : "text-success-600"
                    : shouldAddParentheses
                      ? "text-default-500"
                      : "text-foreground";

            return (
              <td key={period.label} className="text-right py-2 px-3 border-r border-divider">
                <span
                  className={`
                  ${isSubItem ? "text-xs" : "text-sm"}
                  ${textColor}
                  ${isBoldRow ? "font-semibold" : ""}
                `}
                >
                  {formatValue(value, isPercentage, shouldAddParentheses)}
                </span>
              </td>
            );
          })}
          {totalPeriod && (
            <td
              className={`sticky right-0 text-right py-2 px-3 border-l-4 border-primary-200 dark:border-primary-600 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.02)] ${isBoldRow ? "bg-primary-50 dark:bg-primary-100/10" : "bg-content1"}`}
            >
              <span
                className={`
                ${isSubItem ? "text-xs font-medium" : isBoldRow ? "text-sm font-bold" : "text-sm font-semibold"}
                ${
                  metricKey === "netProfit" || metricKey === "grossProfit"
                    ? totalPeriod.metrics[metricKey as keyof PnLMetrics] < 0
                      ? "text-danger"
                      : "text-success"
                    : metricKey === "revenue"
                      ? "text-primary"
                      : metricKey === "netProfitMargin"
                        ? totalPeriod.metrics[metricKey as keyof PnLMetrics] < 0
                          ? "text-danger"
                          : "text-success-600"
                        : isSubItem || shouldAddParentheses
                          ? "text-default-500"
                          : "text-foreground"
                }
              `}
              >
                {formatValue(totalPeriod.metrics[metricKey as keyof PnLMetrics], isPercentage, shouldAddParentheses)}
              </span>
            </td>
          )}
        </tr>
      );
    };

    return (
      <div className="w-full overflow-x-auto border rounded-2xl relative max-w-full">
        <table className="w-full text-sm  min-w-fit">
          <thead className="sticky top-0 z-20">
            <tr className="bg-content2">
              <th className="text-left py-3 px-3 font-semibold text-foreground sticky left-0 bg-content2 min-w-[180px] max-w-[200px] z-30 border-b-2 border-divider shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:chart-square-bold-duotone" width={16} className="text-primary" />
                  <span className="text-xs">Metrics</span>
                </div>
              </th>
              {displayPeriods.map((period) => (
                <th
                  key={period.label}
                  className="text-right py-3 px-3 font-medium text-xs text-default-600 min-w-[110px] border-r border-divider border-b-2 border-divider"
                >
                  {formatPeriodLabel(period)}
                </th>
              ))}
              {totalPeriod && (
                <th className="sticky right-0 text-right py-3 px-3 font-bold text-xs text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-100/10 min-w-[100px] border-l-4 border-primary-500 border-b-2 border-divider z-30 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                  TOTAL
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Revenue Section */}
            <tr className="bg-success-50 dark:bg-success-100/10">
              <td
                colSpan={displayPeriods.length + 1 + (totalPeriod ? 1 : 0)}
                className="px-4 py-2.5 border-b border-divider"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-success rounded-full" />
                  <span className="text-xs font-bold tracking-wider uppercase text-success-700 dark:text-success-400">
                    Revenue
                  </span>
                </div>
              </td>
            </tr>
            {Object.entries(metricConfig)
              .filter(([_, config]) => !config.hidden && config.category === "revenue")
              .map(([key, config]) => renderMetricRow(key, config))}

            {/* Spacer */}
            <tr className="h-2">
              <td
                colSpan={displayPeriods.length + 1 + (totalPeriod ? 1 : 0)}
                className="bg-transparent"
              />
            </tr>

            {/* COGS Section */}
            <tr className="bg-danger-50 dark:bg-danger-100/10">
              <td
                colSpan={displayPeriods.length + 1 + (totalPeriod ? 1 : 0)}
                className="px-4 py-2.5 border-b border-divider"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-danger rounded-full" />
                  <span className="text-xs font-bold tracking-wider uppercase text-danger-700 dark:text-danger-400">
                    Cost of Goods Sold
                  </span>
                </div>
              </td>
            </tr>
            {Object.entries(metricConfig)
              .filter(([_, config]) => !config.hidden && config.category === "cogs")
              .map(([key, config]) => renderMetricRow(key, config))}

            {/* Spacer */}
            <tr className="h-2">
              <td
                colSpan={displayPeriods.length + 1 + (totalPeriod ? 1 : 0)}
                className="bg-transparent"
              />
            </tr>

            {/* Gross Profit */}
            {renderMetricRow("grossProfit", metricConfig.grossProfit)}

            {/* Spacer */}
            <tr className="h-2">
              <td
                colSpan={displayPeriods.length + 1 + (totalPeriod ? 1 : 0)}
                className="bg-transparent"
              />
            </tr>

            {/* Operating Expenses Section */}
            <tr className="bg-warning-50 dark:bg-warning-100/10">
              <td
                colSpan={displayPeriods.length + 1 + (totalPeriod ? 1 : 0)}
                className="px-4 py-2.5 border-b border-divider"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-warning rounded-full" />
                  <span className="text-xs font-bold tracking-wider uppercase text-warning-700 dark:text-warning-400">
                    Operating Expenses
                  </span>
                </div>
              </td>
            </tr>
            {Object.entries(metricConfig)
              .filter(([_, config]) => !config.hidden && config.category === "operations")
              .map(([key, config]) => renderMetricRow(key, config))}

            {/* Spacer */}
            <tr className="h-4">
              <td
                colSpan={displayPeriods.length + 1 + (totalPeriod ? 1 : 0)}
                className="bg-transparent"
              />
            </tr>

            {/* Net Profit Section */}
            {renderMetricRow("netProfit", metricConfig.netProfit)}
            {renderMetricRow("netProfitMargin", metricConfig.netProfitMargin)}
          </tbody>
        </table>
      </div>
    );
  }, [periods, granularity, dateRange, isDeduction, formatValue]);

  return (
    <>
      {/* Header with integrated granularity tabs */}
      <div className="">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Profit & Loss Statement
          </h3>
          {setGranularity && (
            <Tabs
              aria-label="P&L granularity"
              radius="lg"
              color="primary"
              selectedKey={granularity}
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
        <div className="pb-6">{tableContent}</div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="p-4 bg-content2 rounded-full mb-4">
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
    </>
  );
});
