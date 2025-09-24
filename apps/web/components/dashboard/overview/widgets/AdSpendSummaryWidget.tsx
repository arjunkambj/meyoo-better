"use client";

import { Card, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { formatCurrency, formatCurrencyCompact } from "@/libs/utils/format";

interface MetricProps {
  label: string;
  value: number | string;
  change?: number;
  format?: "currency" | "decimal" | "percentage";
  currency?: string;
  isPrimary?: boolean;
  hint?: string;
}

function Metric({
  label,
  value,
  change,
  format = "decimal",
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
        return `${value.toFixed(1)}%`;
      default:
        return value.toFixed(2);
    }
  };

  const changeBadgeClasses =
    change === undefined
      ? "bg-default-100/80 dark:bg-default-100/10 text-default-600"
      : change > 0
        ? "bg-success-100/60 dark:bg-success-500/20 text-success-700"
        : change < 0
          ? "bg-danger-100/60 dark:bg-danger-500/20 text-danger-700"
          : "bg-warning-100/60 dark:bg-warning-500/20 text-warning-700";

  const containerBaseClasses =
    "group rounded-2xl border border-default-100 bg-white dark:bg-default-50 transition-colors";

  return (
    <div
      className={`${containerBaseClasses} ${
        isPrimary
          ? "p-4 shadow-sm"
          : "p-3 hover:bg-default-100/80 dark:hover:bg-default-100/20"
      }`}
      aria-label={`${label} metric`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`${isPrimary ? "text-sm font-semibold" : "text-xs"} text-default-900`}
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
            className={`${isPrimary ? "text-xl font-bold" : "text-sm font-semibold"} text-default-900`}
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

interface AdSpendSummaryWidgetProps {
  totalAdSpend: number;
  adSpendChange?: number;
  roas: number;
  roasChange?: number;
  poas: number;
  poasChange?: number;
  ncROAS: number;
  ncROASChange?: number;
  roasUTM: number;
  roasUTMChange?: number;
  currency?: string;
  loading?: boolean;
}

export function AdSpendSummaryWidget({
  totalAdSpend,
  adSpendChange,
  roas,
  roasChange,
  poas,
  poasChange,
  ncROAS,
  ncROASChange,
  roasUTM,
  roasUTMChange,
  currency = "USD",
  loading = false,
}: AdSpendSummaryWidgetProps) {
  if (loading) {
    return (
      <Card
        className="p-6 bg-default-100 dark:bg-content1 border border-default-50 rounded-2xl"
        shadow="none"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-default-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-6 bg-default-200 rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-6 bg-default-100/90 dark:bg-content1 border border-default-50 rounded-2xl h-full"
      shadow="none"
    >
      <div className="mb-5 pb-4 border-b border-default-100">
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:chart-square-bold-duotone"
            width={20}
            className="text-primary"
          />
          <h3 className="text-lg font-medium text-default-900">
            Ad Spend Summary
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        <Metric
          change={adSpendChange}
          currency={currency}
          format="currency"
          isPrimary={true}
          label="Total Ad Spend"
          hint="Total advertising spend across all channels"
          value={totalAdSpend}
        />

        <Metric
          change={roasChange}
          format="decimal"
          label="Blended ROAS"
          hint="Return on Ad Spend (Revenue / Ad Spend)"
          value={roas}
        />

        <Metric
          change={poasChange}
          format="decimal"
          label="POAS"
          hint="Profit on Ad Spend (Profit / Ad Spend)"
          value={poas}
        />

        <Metric
          change={ncROASChange}
          format="decimal"
          label="ncROAS"
          hint="New Customer Return on Ad Spend"
          value={ncROAS}
        />

        <Metric
          change={roasUTMChange}
          format="decimal"
          label="UTM ROAS"
          hint="ROAS calculated from UTM-tracked conversions"
          value={roasUTM}
        />
      </div>
    </Card>
  );
}
