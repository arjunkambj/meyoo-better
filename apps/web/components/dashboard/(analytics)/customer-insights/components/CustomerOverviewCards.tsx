"use client";

import { memo, useMemo } from "react";

import KPI from "@/components/shared/cards/KPI";
import { useUser } from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  avgLTV: number;
  avgCAC: number;
  ltvCacRatio: number;
  changes: {
    totalCustomers: number;
    newCustomers: number;
    avgLTV: number;
  };
}

interface CustomerOverviewCardsProps {
  metrics?: CustomerMetrics;
}

export const CustomerOverviewCards = memo(function CustomerOverviewCards({
  metrics,
}: CustomerOverviewCardsProps) {
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  const formatNumber = useMemo(
    () => (value: number) =>
      new Intl.NumberFormat("en-US").format(Number.isNaN(value) ? 0 : value),
    [],
  );

  const formatCurrency = useMemo(
    () => (value: number) =>
      `${currencySymbol}${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number.isNaN(value) ? 0 : value)}`,
    [currencySymbol],
  );

  const formatChange = useMemo(
    () =>
      (value: number, inverse: boolean = false) => {
        const safeValue = Number.isNaN(value) ? 0 : value;
        const isPositive = inverse ? safeValue <= 0 : safeValue >= 0;

        return {
          text: `${safeValue >= 0 ? "+" : ""}${safeValue.toFixed(1)}%`,
          type: isPositive ? ("positive" as const) : ("negative" as const),
          trend: value >= 0 ? ("up" as const) : ("down" as const),
        };
      },
    [],
  );

  const cards = useMemo(
    () =>
      metrics
        ? [
            {
              title: "Total Customers",
              value: formatNumber(metrics.totalCustomers),
              change: formatChange(metrics.changes.totalCustomers),
              icon: "solar:users-group-rounded-bold-duotone",
            },
            {
              title: "New Customers",
              value: formatNumber(metrics.newCustomers),
              change: formatChange(metrics.changes.newCustomers),
              icon: "solar:user-plus-rounded-bold-duotone",
            },
            {
              title: "Avg LTV",
              value: formatCurrency(metrics.avgLTV),
              change: formatChange(metrics.changes.avgLTV),
              icon: "solar:dollar-minimalistic-bold-duotone",
            },
            {
              title: "LTV:CAC",
              value: `${!Number.isNaN(metrics.ltvCacRatio) ? metrics.ltvCacRatio.toFixed(1) : "0.0"}x`,
              change: formatChange((metrics.ltvCacRatio - 3) * 33.33), // Target is 3x
              icon: "solar:graph-up-bold-duotone",
              subtitle: `CAC: ${formatCurrency(metrics.avgCAC)}`,
            },
          ]
        : [],
    [metrics, formatNumber, formatCurrency, formatChange],
  );

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPI key={i} loading title="" value="" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <KPI
          key={card.title}
          change={card.change.text.replace("%", "")}
          changeType={card.change.type}
          icon={card.icon}
          subtitle={card.subtitle}
          title={card.title}
          value={card.value}
        />
      ))}
    </div>
  );
});
