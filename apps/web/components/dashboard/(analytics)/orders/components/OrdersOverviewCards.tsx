"use client";

import { memo } from "react";

import KPI from "@/components/shared/cards/KPI";
import { useUser } from "@/hooks";
import { getCurrencySymbol, formatNumber } from "@/libs/utils/format";

export interface OrdersOverviewMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  totalTax: number;
  avgOrderValue: number;
  customerAcquisitionCost: number;
  grossMargin: number;
  fulfillmentRate: number;
  changes: {
    totalOrders: number;
    revenue: number;
    netProfit: number;
    avgOrderValue: number;
    cac: number;
    margin: number;
    fulfillmentRate: number;
  };
}

interface OrdersOverviewCardsProps {
  metrics?: OrdersOverviewMetrics;
}

export const OrdersOverviewCards = memo(function OrdersOverviewCards({
  metrics,
}: OrdersOverviewCardsProps) {
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <KPI key={i} loading title="Loading..." value="-" />
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isNaN(value) ? 0 : value)}`;
  };

  const cards = [
    {
      title: "Total Orders",
      value: formatNumber(metrics.totalOrders),
      change: metrics.changes.totalOrders,
      icon: "solar:bag-4-bold-duotone",
      subtitle: `AOV: ${formatCurrency(metrics.avgOrderValue)}`,
    },
    {
      title: "Total Revenue",
      value: formatCurrency(metrics.totalRevenue),
      change: metrics.changes.revenue,
      icon: "solar:money-bag-bold-duotone",
      subtitle: `Costs: ${formatCurrency(metrics.totalCosts)}`,
    },
    {
      title: "Net Profit",
      value: formatCurrency(metrics.netProfit),
      change: metrics.changes.netProfit,
      icon: "solar:graph-up-bold-duotone",
      subtitle: `Margin: ${metrics.grossMargin.toFixed(1)}%`,
    },
    {
      title: "Tax & Fees",
      value: formatCurrency(metrics.totalTax),
      change: 0,
      icon: "solar:bill-list-bold-duotone",
      subtitle: `CAC: ${formatCurrency(metrics.customerAcquisitionCost)}`,
    },
    {
      title: "Fulfillment Rate",
      value: `${(metrics.fulfillmentRate || 0).toFixed(1)}%`,
      change: metrics.changes.fulfillmentRate,
      icon: "solar:delivery-bold-duotone",
      subtitle: "Orders fulfilled",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <KPI
          key={card.title}
          change={card.change}
          icon={card.icon}
          subtitle={card.subtitle}
          title={card.title}
          value={card.value}
        />
      ))}
    </div>
  );
});
