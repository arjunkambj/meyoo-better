"use client";

import { memo } from "react";

import KPI from "@/components/shared/cards/KPI";
import { useUser } from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";
import type { PnLKPIMetrics } from "@repo/types";

interface PnLKPICardsProps {
  metrics?: PnLKPIMetrics;
  isLoading?: boolean;
}

export const PnLKPICards = memo(function PnLKPICards({
  metrics,
  isLoading = false,
}: PnLKPICardsProps) {
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  const formatCurrency = (value: number) => {
    const safeValue = Number.isNaN(value) ? 0 : value;
    return `${currencySymbol}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safeValue)}`;
  };

  const formatPercentage = (value: number) => {
    const safeValue = Number.isNaN(value) ? 0 : value;

    return `${safeValue.toFixed(1)}%`;
  };

  if (!metrics && !isLoading) {
    return null;
  }

  const kpiData = [
    {
      title: "Net Revenue",
      value: formatCurrency(metrics?.netRevenue ?? 0),
      subtitle: "after returns",
      change: metrics?.changes?.netRevenue,
      changeType:
        (metrics?.changes?.netRevenue ?? 0) >= 0
          ? "positive"
          : ("negative" as const),
      icon: "solar:wallet-money-bold-duotone",
      iconColor: "text-default-500",
    },
    {
      title: "Gross Profit",
      value: formatCurrency(metrics?.grossProfit ?? 0),
      change: metrics?.changes?.grossProfit,
      changeType:
        (metrics?.changes?.grossProfit ?? 0) >= 0
          ? "positive"
          : ("negative" as const),
      icon: "solar:graph-new-up-bold-duotone",
      iconColor: "text-default-500",
    },
    {
      title: "Net Profit",
      value: formatCurrency(metrics?.netProfit ?? 0),
      subtitle: `${formatPercentage(metrics?.netMargin ?? 0)} margin`,
      change: metrics?.changes?.netProfit,
      changeType:
        (metrics?.changes?.netProfit ?? 0) >= 0
          ? "positive"
          : ("negative" as const),
      icon: "solar:dollar-minimalistic-bold-duotone",
      iconColor: "text-default-500",
    },
    {
      title: "Marketing",
      value: formatCurrency(metrics?.marketingCost ?? 0),
      subtitle: `${(metrics?.marketingROAS ?? 0).toFixed(1)}x ROAS`,
      change: metrics?.changes?.marketingCost,
      changeType:
        (metrics?.changes?.marketingCost ?? 0) <= 0
          ? "positive"
          : ("negative" as const),
      icon: "mingcute:meta-fill",
      iconColor: "text-default-500",
    },
    {
      title: "Op. Expenses",
      value: formatCurrency(metrics?.operatingExpenses ?? 0),
      change: -(metrics?.changes?.operatingExpenses ?? 0),
      changeType:
        (metrics?.changes?.operatingExpenses ?? 0) <= 0
          ? "positive"
          : ("negative" as const),
      icon: "solar:calculator-bold-duotone",
      iconColor: "text-default-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {kpiData.map((kpi) => (
        <KPI
          key={kpi.title}
          change={kpi.change}
          changeType={kpi.changeType as "positive" | "negative" | "neutral"}
          icon={kpi.icon}
          iconColor={kpi.iconColor}
          loading={isLoading}
          subtitle={kpi.subtitle}
          title={kpi.title}
          value={kpi.value}
        />
      ))}
    </div>
  );
});
