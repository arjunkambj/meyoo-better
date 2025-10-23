"use client";

import KPI from "@/components/shared/cards/KPI";
import { useUser } from "@/hooks";
import { getCurrencySymbol, formatNumber } from "@/libs/utils/format";

interface InventoryMetrics {
  totalValue: number;
  totalCOGS: number;
  totalSKUs: number;
  stockCoverageDays: number;
  deadStock: number;
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPI key={i} loading title="Loading..." value="-" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Inventory Value",
      value: `${currencySymbol}${formatNumber(metrics.totalValue)}`,
      icon: "solar:box-bold-duotone",
      iconColor: "text-default-500",
      subtitle: `Total value across ${metrics.totalSKUs} SKUs`,
    },
    {
      title: "Stock Coverage",
      value: `${metrics.stockCoverageDays} days`,
      icon: "solar:clock-circle-bold-duotone",
      iconColor: "text-default-500",
      subtitle: "Days of inventory remaining",
    },
    {
      title: "Dead Stock",
      value: formatNumber(metrics.deadStock),
      icon: "solar:trash-bin-trash-bold-duotone",
      iconColor: "text-default-500",
      subtitle: "Items not sold in 90+ days",
    },
    {
      title: "COGS Value",
      value: `${currencySymbol}${formatNumber(metrics.totalCOGS)}`,
      icon: "solar:wallet-money-bold-duotone",
      iconColor: "text-default-500",
      subtitle: "Cost of goods for active range",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <KPI
          key={card.title}
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
