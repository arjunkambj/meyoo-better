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
        // Use compact currency for larger values for quick scanning
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

  const changeColor =
    change === undefined
      ? "text-default-400"
      : change > 0
        ? "text-success"
        : change < 0
          ? "text-danger"
          : "text-warning";

  return (
    <div
      className="flex justify-between items-center py-2"
      aria-label={`${label} metric`}
    >
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
  );
}

interface AdSpendSummaryWidgetProps {
  totalAdSpend: number;
  adSpendChange?: number;
  poas: number;
  poasChange?: number;
  roas: number;
  roasChange?: number;
  roasUTM: number;
  roasUTMChange?: number;
  ncROAS: number;
  ncROASChange?: number;
  currency?: string;
  loading?: boolean;
}

export function AdSpendSummaryWidget({
  totalAdSpend,
  adSpendChange,
  poas,
  poasChange,
  roas,
  roasChange,
  roasUTM,
  roasUTMChange,
  ncROAS,
  ncROASChange,
  currency = "USD",
  loading = false,
}: AdSpendSummaryWidgetProps) {
  if (loading) {
    return (
      <Card
        className="p-6 bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50"
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
      className="p-5 bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50 h-full"
      shadow="none"
    >
      <div className="mb-3 pb-3 border-b border-divider">
        <h3 className="text-sm font-medium text-default-900">
          Ad Spend Summary
        </h3>
      </div>

      <div className="space-y-0.5">
        <Metric
          change={adSpendChange}
          currency={currency}
          format="currency"
          isPrimary={true}
          label="Total Ad Spend"
          hint="Total ad platforms spend for the selected period"
          value={totalAdSpend}
        />

        <Metric
          change={poasChange}
          format="decimal"
          label="POAS"
          hint="Profit on Ad Spend = Profit / Ad Spend"
          value={poas}
        />

        <Metric
          change={roasChange}
          format="decimal"
          label="ROAS"
          hint="Return on Ad Spend = Revenue / Ad Spend"
          value={roas}
        />

        <Metric
          change={roasUTMChange}
          format="decimal"
          label="ROAS (UTM)"
          hint="ROAS based only on UTM-attributed orders"
          value={roasUTM}
        />

        <Metric
          change={ncROASChange}
          format="decimal"
          label="ncROAS"
          hint="New customer ROAS for first-time buyers"
          value={ncROAS}
        />
      </div>
    </Card>
  );
}
