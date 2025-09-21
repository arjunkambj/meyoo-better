"use client";

import { Card, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { formatCurrency, formatCurrencyCompact } from "@/libs/utils/format";

interface MetricProps {
  label: string;
  value: number | string;
  change?: number;
  format?: "number" | "percentage" | "currency";
  currency?: string;
  isPrimary?: boolean;
  hint?: string;
}

function Metric({
  label,
  value,
  change,
  format = "number",
  currency = "USD",
  isPrimary = false,
  hint,
}: MetricProps) {
  const formatValue = () => {
    if (typeof value === "string") return value;

    switch (format) {
      case "currency": {
        return Math.abs(value) >= 1000
          ? formatCurrencyCompact(value, currency)
          : formatCurrency(value, currency);
      }
      case "percentage":
        return `${value.toFixed(0)}%`;
      default:
        return value.toLocaleString();
    }
  };

  const changeColor =
    change === undefined
      ? "text-default-400"
      : change > 0
        ? "text-success"
        : change < 0
          ? "text-danger"
          : "text-warning";

  return (
    <div className="py-2" aria-label={`${label} metric`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <span
            className={`${isPrimary ? "text-sm" : "text-xs"} text-default-800 font-medium`}
          >
            {label}
          </span>
          {hint && (
            <Tooltip content={hint} placement="top" delay={200} closeDelay={50}>
              <span className="text-default-400 cursor-help">
                <Icon icon="solar:info-circle-bold" width={14} />
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`${isPrimary ? "text-lg font-bold" : "text-sm font-semibold"} text-foreground`}
          >
            {formatValue()}
          </span>
          {change !== undefined && (
            <div
              aria-label={`Change ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)} percent`}
              className={`flex items-center gap-0.5 ${changeColor}`}
            >
              <Icon
                icon={
                  change >= 0
                    ? "solar:arrow-up-linear"
                    : "solar:arrow-down-linear"
                }
                width={10}
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
  totalCustomers: number;
  totalCustomersChange?: number;
  newCustomers: number;
  newCustomersChange?: number;
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
  totalCustomers,
  totalCustomersChange,
  newCustomers,
  newCustomersChange,
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
        className="p-6 bg-content2/90 dark:bg-content1 rounded-2xl border border-default-200/50"
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
      className="p-5 bg-content2/90 dark:bg-content1 rounded-2xl border border-default-200/50 h-full"
      shadow="none"
    >
      <div className="mb-2.5 pb-2.5 border-b border-divider">
        <h3 className="text-lg font-medium text-default-900">
          Customer Summary
        </h3>
      </div>

      <div className="space-y-0.5">
        <Metric
          change={totalCustomersChange}
          format="number"
          isPrimary={true}
          label="Total Customers"
          hint="Total unique customers in your store"
          value={totalCustomers}
        />

        <Metric
          change={newCustomersChange}
          format="number"
          label="New Customers"
          hint="Customers placing their first order in the period"
          value={newCustomers}
        />

        <Metric
          change={repurchaseRateChange}
          format="percentage"
          label="Repurchase Rate"
          hint="Percentage of customers who purchased again"
          value={repurchaseRate}
        />

        <Metric
          change={returnRateChange}
          format="percentage"
          label="Return Rate"
          hint="Percentage of orders that were returned"
          value={returnRate}
        />

        <Metric
          change={cacChange}
          currency={currency}
          format="currency"
          label="CAC"
          hint="Customer Acquisition Cost per new customer"
          value={cac}
        />
      </div>
    </Card>
  );
}
