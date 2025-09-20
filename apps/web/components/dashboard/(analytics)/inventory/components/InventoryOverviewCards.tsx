"use client";

import KPI from "@/components/shared/cards/KPI";
import { useUser } from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";

interface InventoryMetrics {
  totalValue: number;
  totalCOGS: number;
  totalSKUs: number;
  totalProducts: number;
  lowStockItems: number;
  outOfStockItems: number;
  stockCoverageDays: number;
  deadStock: number;
  totalSales: number;
  unitsSold: number;
  averageSalePrice: number;
  averageProfit: number;
  stockTurnoverRate: number;
  changes: {
    totalValue: number;
    totalCOGS: number;
    totalSKUs: number;
    stockCoverage: number;
    totalSales: number;
    unitsSold: number;
    stockTurnoverRate: number;
  };
}

interface InventoryOverviewCardsProps {
  metrics: InventoryMetrics | null | undefined;
}

export function InventoryOverviewCards({
  metrics,
}: InventoryOverviewCardsProps) {
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <KPI key={i} loading title="Loading..." value="-" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Inventory Value",
      value: `${currencySymbol}${metrics.totalCOGS.toLocaleString()}`,
      change: metrics.changes.totalCOGS,
      icon: "solar:box-bold-duotone",
      subtitle: `Cost value of ${metrics.totalSKUs} SKUs`,
    },
    {
      title: "Average Sale Price",
      value: `${currencySymbol}${metrics.averageSalePrice.toFixed(2)}`,
      change: 0,
      icon: "solar:tag-price-bold-duotone",
      subtitle: "Per unit sold",
    },
    {
      title: "Stock Coverage",
      value: `${metrics.stockCoverageDays} days`,
      change: metrics.changes.stockCoverage,
      icon: "solar:clock-circle-bold-duotone",
      subtitle: "Days of inventory remaining",
    },
    {
      title: "Dead Stock",
      value: metrics.deadStock.toLocaleString(),
      change: 0,
      icon: "solar:trash-bin-minimalistic-bold-duotone",
      iconColor: metrics.deadStock > 0 ? "text-danger" : "text-primary",
      subtitle: "Items not sold in 90+ days",
    },
    {
      title: "Stock Turnover",
      value: `${(metrics.stockTurnoverRate || 0).toFixed(1)}x`,
      change: metrics.changes.stockTurnoverRate,
      icon: "solar:refresh-bold-duotone",
      subtitle: "Inventory turns per year",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <KPI
          key={card.title}
          change={card.change}
          icon={card.icon}
          iconColor={card.iconColor}
          subtitle={card.subtitle}
          title={card.title}
          value={card.value}
        />
      ))}
    </div>
  );
}


