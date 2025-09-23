"use client";

import { memo } from "react";

import KPI from "@/components/shared/cards/KPI";
import { useUser } from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";

export interface PnLKPIMetrics {
  grossSales: number;
  discountsReturns: number;
  netRevenue: number;
  grossProfit: number;
  operatingExpenses: number;
  ebitda: number;
  netProfit: number;
  netMargin: number;
  marketingCost: number;
  marketingROAS: number;
  marketingROI: number;
  changes: {
    grossSales: number;
    discountsReturns: number;
    netRevenue: number;
    grossProfit: number;
    operatingExpenses: number;
    ebitda: number;
    netProfit: number;
    netMargin: number;
    marketingCost: number;
    marketingROAS: number;
    marketingROI: number;
  };
}

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
    const absValue = Math.abs(safeValue);

    if (absValue >= 1000000) {
      return `${currencySymbol}${(safeValue / 1000000).toFixed(2)}M`;
    } else if (absValue >= 1000) {
      return `${currencySymbol}${(safeValue / 1000).toFixed(1)}K`;
    }

    return `${currencySymbol}${safeValue.toFixed(0)}`;
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
      title: "Gross Sales",
      value: formatCurrency(metrics?.grossSales ?? 0),
      change: metrics?.changes?.grossSales,
      changeType:
        (metrics?.changes?.grossSales ?? 0) >= 0
          ? "positive"
          : ("negative" as const),
      icon: "solar:money-bag-bold-duotone",
      // Use primary for top-line sales
      iconColor: "text-primary",
    },
    {
      title: "Net Revenue",
      value: formatCurrency(metrics?.netRevenue ?? 0),
      subtitle: "after returns",
      change: metrics?.changes?.netRevenue,
      changeType:
        (metrics?.changes?.netRevenue ?? 0) >= 0
          ? "positive"
          : ("negative" as const),
      icon: "solar:card-receive-bold-duotone",
      // Revenue tends to read as success
      iconColor: "text-success",
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
      // Profit distinct from revenue: secondary accent
      iconColor: "text-secondary",
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
      icon: "solar:megaphone-bold-duotone",
      // Cost category: use warning accent
      iconColor: "text-warning",
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
      // Expense category: danger accent for contrast with others
      iconColor: "text-danger",
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
