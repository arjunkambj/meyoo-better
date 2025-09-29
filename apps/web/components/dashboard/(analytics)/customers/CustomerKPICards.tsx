"use client";

import { memo, useMemo } from "react";

import KPI, { KPISkeleton } from "@/components/shared/cards/KPI";

interface CustomerKPICardsProps {
  loading?: boolean;
  metrics?: {
    periodCustomerCount: number;
    prepaidRate: number;
    periodRepeatRate: number;
    abandonedCartCustomers: number;
  };
}

const formatPercent = (value: number) =>
  `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

const formatInteger = (value: number) =>
  new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);

export const CustomerKPICards = memo(function CustomerKPICards({
  loading = false,
  metrics,
}: CustomerKPICardsProps) {
  const items = useMemo(() => {
    if (!metrics) return [];

    return [
      {
        title: "Total Customers",
        value: formatInteger(metrics.periodCustomerCount),
        icon: "solar:users-group-two-rounded-bold-duotone",
        tooltip:
          "Unique customers who placed an order within the selected date range.",
      },
      {
        title: "Prepaid Rate",
        value: formatPercent(metrics.prepaidRate),
        icon: "solar:bill-list-bold-duotone",
        tooltip: "Percentage of orders marked as paid during the selected period.",
      },
      {
        title: "Repeat Rate",
        value: formatPercent(metrics.periodRepeatRate),
        icon: "solar:refresh-circle-bold-duotone",
        tooltip:
          "Share of period customers who placed two or more orders in the selected window.",
      },
      {
        title: "Abandoned Carts",
        value: formatInteger(metrics.abandonedCartCustomers),
        icon: "solar:cart-cross-bold-duotone",
        tooltip:
          "Customers created in the selected date range who have not completed an order.",
      },
    ];
  }, [metrics]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <KPISkeleton key={`customer-kpi-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <KPI
          key={item.title}
          icon={item.icon}
          size="small"
          title={item.title}
          tooltip={item.tooltip}
          value={item.value}
        />
      ))}
    </div>
  );
});
