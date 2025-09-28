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

  return (
    <div
      className={`${isPrimary ? "py-2 px-3 bg-background border border-default-50 rounded-xl" : "py-2.5 px-3 border-b border-default-200 last:border-0"}`}
      aria-label={`${label} metric`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`${isPrimary ? "text-sm font-medium" : "text-xs"} text-default-900`}
          >
            {label}
          </span>
          {hint && (
            <Tooltip content={hint} placement="top" delay={200} closeDelay={50}>
              <span className="text-default-400 cursor-help">
                <Icon icon="solar:info-circle-linear" width={14} />
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`${isPrimary ? "text-xl font-bold" : "text-sm font-semibold"} text-default-800`}
          >
            {formatValue()}
          </span>
          {change !== undefined && (
            <div
              aria-label={`Change ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)} percent`}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${changeBadgeClasses}`}
            >
              <Icon
                icon={
                  change >= 0
                    ? "solar:arrow-up-linear"
                    : "solar:arrow-down-linear"
                }
                width={12}
              />
              <span className="text-xs font-medium">
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
  repurchaseRate: number;
  repurchaseRateChange?: number;
  returnRate: number;
  returnRateChange?: number;
  cac: number;
  cacChange?: number;
  currency?: string;
  loading?: boolean;
}

export function CustomerSummaryWidget({
  repurchaseRate,
  repurchaseRateChange,
  returnRate,
  returnRateChange,
  cac,
  cacChange,
  currency = "USD",
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
      className="p-5 bg-default-100 dark:bg-content1 border border-default-50 rounded-2xl"
      shadow="none"
    >
      <div className="mb-3.5 pb-3.5 border-b border-divider">
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:users-group-two-rounded-bold-duotone"
            width={20}
            className="text-primary"
          />
          <h3 className="text-lg font-medium text-default-900">
            Customer Summary
          </h3>
        </div>
      </div>

      <div className="space-y-1">
        <Metric
          change={repurchaseRateChange}
          format="percentage"
          isPrimary
          label="Repurchase Rate"
          hint="Percentage of customers who purchased again"
          value={repurchaseRate}
        />

        <Metric
          change={returnRateChange}
          format="percentage"
          label="Return Rate"
          hint="Percentage of orders that were returned"
          goodWhenLower
          value={returnRate}
        />

        <Metric
          change={cacChange}
          currency={currency}
          format="currency"
          label="CAC"
          hint="Customer Acquisition Cost per new customer"
          goodWhenLower
          value={cac}
        />
      </div>
    </Card>
  );
}
