import { useMemo } from "react";
import { useQuery } from "convex/react";

import { api } from "@/libs/convexApi";
import { formatCurrency, formatCurrencyChange, getCurrencySymbol } from "@/libs/currency";

import { useCurrentUser } from "./useCurrentUser";

export type Metric = {
  id: string;
  label: string;
  value: number;
  change?: number | null;
  prefix?: string;
  suffix?: string;
  decimal?: number;
};

export type DisplayMetric = Metric & {
  displayValue: string;
  delta: string | null;
};

function formatNumber(value: number, decimal = 0) {
  if (Number.isNaN(value)) {
    return "–";
  }
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimal,
    maximumFractionDigits: decimal,
  });
  return formatter.format(value);
}

export function useAnalytics() {
  const { primaryCurrency } = useCurrentUser();
  const summary = useQuery(api.web.dashboard.getDashboardSummary, {
    timeRange: "30d",
  });
  const realTime = useQuery(api.web.analytics.getRealTimeMetrics);

  const metrics = useMemo<Metric[]>(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        id: "revenue",
        label: "Revenue",
        value: summary.revenue ?? 0,
        change: summary.revenueChange ?? null,
        prefix: getCurrencySymbol(primaryCurrency),
        decimal: 0,
      },
      {
        id: "profit",
        label: "Net Profit",
        value: summary.profit ?? 0,
        change: summary.profitChange ?? null,
        prefix: getCurrencySymbol(primaryCurrency),
        decimal: 0,
      },
      {
        id: "margin",
        label: "Profit Margin",
        value: summary.profitMargin ?? 0,
        change: summary.profitMarginChange ?? null,
        suffix: "%",
        decimal: 1,
      },
      {
        id: "orders",
        label: "Orders",
        value: summary.orders ?? 0,
        change: summary.ordersChange ?? null,
        decimal: 0,
      },
      {
        id: "aov",
        label: "AOV",
        value: summary.avgOrderValue ?? 0,
        change: summary.avgOrderValueChange ?? null,
        prefix: getCurrencySymbol(primaryCurrency),
        decimal: 2,
      },
      {
        id: "roas",
        label: "ROAS",
        value: summary.roas ?? 0,
        change: summary.roasChange ?? null,
        decimal: 2,
      },
    ];
  }, [summary, primaryCurrency]);

  const formatted = useMemo<DisplayMetric[]>(
    () =>
      metrics.map((metric) => {
        const decimalDigits = metric.decimal ?? 0;
        const displayValue = metric.prefix
          ? formatCurrency(metric.value, primaryCurrency, {
              minimumFractionDigits: decimalDigits,
              maximumFractionDigits: decimalDigits,
            })
          : formatNumber(metric.value, metric.decimal);
        const delta =
          metric.change === null || metric.change === undefined
            ? null
            : metric.suffix === "%"
              ? `${metric.change.toFixed(1)}%`
              : metric.prefix
                ? formatCurrencyChange(metric.change, primaryCurrency, decimalDigits)
                : formatNumber(metric.change, metric.decimal);
        return {
          ...metric,
          displayValue,
          delta,
        } satisfies DisplayMetric;
      }),
    [metrics, primaryCurrency],
  );

  return {
    metrics: formatted,
    rawMetrics: metrics,
    isLoading: summary === undefined,
    realTime,
    currency: primaryCurrency,
  };
}
