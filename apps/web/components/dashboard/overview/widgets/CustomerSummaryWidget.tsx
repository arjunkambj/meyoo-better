"use client";

import { Card, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
} from "@/libs/utils/format";

interface MetricProps {
  label: string;
  value: number | string;
  change?: number;
  format?: "number" | "percentage" | "currency";
  currency?: string;
  isPrimary?: boolean;
  hint?: string;
  goodWhenLower?: boolean;
}

function Metric({
  label,
  value,
  change,
  format = "number",
  currency = "USD",
  isPrimary = false,
  hint,
  goodWhenLower = false,
}: MetricProps) {
  const formatValue = () => {
    if (typeof value === "string") return value;

    switch (format) {
      case "currency": {
        return Math.abs(value) >= 10000000
          ? formatCurrencyCompact(value, currency)
          : formatCurrency(value, currency);
      }
      case "percentage":
        return `${value.toFixed(0)}%`;
      default:
        return formatNumber(value);
    }
  };

  // Align change chip design with Order/AdSpend widgets
  const isGood =
    change === undefined || change === 0
      ? null
      : goodWhenLower
        ? change < 0
        : change > 0;

  const changeBadgeClasses =
    change === undefined
      ? "bg-default-100/80 dark:bg-default-100/10 text-default-600"
      : change === 0
        ? "bg-warning-100/60 dark:bg-warning-500/20 text-warning-700"
        : isGood
          ? "bg-success-100/60 dark:bg-success-500/20 text-success-700"
          : "bg-danger-100/60 dark:bg-danger-500/20 text-danger-700";

  const containerClasses = isPrimary
    ? "py-2 px-3 bg-background border border-default-100 rounded-xl hover:bg-default-50 transition-colors"
    : "py-2.5 px-3 border-b border-default-200 last:border-0 hover:bg-default-50 transition-colors";

  return (
    <div className={containerClasses} aria-label={`${label} metric`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`${isPrimary ? "text-sm font-semibold" : "text-xs font-medium"} text-default-900`}
          >
            {label}
          </span>
          {hint && (
            <Tooltip content={hint} placement="top" delay={200} closeDelay={50}>
              <span className="text-default-500 cursor-help hover:text-default-700 transition-colors">
                <Icon icon="solar:info-circle-bold-duotone" width={16} />
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`${isPrimary ? "text-xl font-bold" : "text-sm font-bold"} text-default-900`}
          >
            {formatValue()}
          </span>
          {change !== undefined && (
            <div
              aria-label={`Change ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)} percent`}
              className={`flex items-center gap-0.5 px-2 py-1 rounded-lg ${changeBadgeClasses}`}
            >
              <Icon
                icon={
                  change >= 0
                    ? "solar:arrow-up-bold"
                    : "solar:arrow-down-bold"
                }
                width={14}
              />
              <span className="text-xs font-semibold">
                {Math.abs(change).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CustomerSummaryWidgetProps {
  totalCustomers: number;
  totalCustomersChange?: number;
  returningCustomers: number;
  returningCustomersChange?: number;
  newCustomers: number;
  newCustomersChange?: number;
  repurchaseRate: number;
  repurchaseRateChange?: number;
  returnRate: number;
  returnRateChange?: number;
  loading?: boolean;
}

export function CustomerSummaryWidget({
  totalCustomers,
  totalCustomersChange,
  returningCustomers,
  returningCustomersChange,
  newCustomers,
  newCustomersChange,
  repurchaseRate,
  repurchaseRateChange,
  returnRate,
  returnRateChange,
  loading = false,
}: CustomerSummaryWidgetProps) {
  if (loading) {
    return (
      <Card
        className="p-6 bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50"
        shadow="none"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-default-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 bg-default-200 rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-5 bg-default-100 dark:bg-content1 border border-default-50 rounded-2xl h-full"
      shadow="none"
    >
      <div className="mb-4 pb-4 border-b border-divider">
        <div className="flex items-center gap-2.5">
          <Icon
            icon="solar:users-group-rounded-bold-duotone"
            width={24}
            className="text-default-500"
          />
          <h3 className="text-lg font-semibold text-default-900">
            Customer Summary
          </h3>
        </div>
      </div>

      <div className="space-y-1">
        <Metric
          change={totalCustomersChange}
          format="number"
          isPrimary
          label="Total Customers"
          hint="Unique customers in the selected period"
          value={totalCustomers}
        />

        <Metric
          change={repurchaseRateChange}
          format="percentage"
          label="Repurchase Rate"
          hint="Percentage of customers who purchased again"
          value={repurchaseRate}
        />

        <Metric
          change={returningCustomersChange}
          format="number"
          label="Returning Customers"
          hint="Customers who purchased more than once"
          value={returningCustomers}
        />

        <Metric
          change={newCustomersChange}
          format="number"
          label="New Customers"
          hint="First-time customers acquired"
          value={newCustomers}
        />

        <Metric
          change={returnRateChange}
          format="percentage"
          label="Return Rate"
          hint="Percentage of orders that were returned"
          goodWhenLower
          value={returnRate}
        />
      </div>
    </Card>
  );
}
