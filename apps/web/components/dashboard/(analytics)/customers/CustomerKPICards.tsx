"use client";

import { memo, useMemo } from "react";

import KPI, { KPISkeleton } from "@/components/shared/cards/KPI";

interface CustomerKPICardsProps {
  loading?: boolean;
  metrics?: {
    totalCustomers: number;
    periodCustomerCount: number;
    prepaidRate: number;
    repeatRate: number;
    abandonedCartCustomers: number;
    abandonedRate: number;
  };
}

const formatPercent = (value: number) =>
  `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;

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
        value: formatInteger(metrics.totalCustomers),
        icon: "solar:users-group-rounded-bold-duotone",
        iconColor: "text-default-500",
        tooltip:
          "Total unique customers captured in analytics for the selected period.",
      },
      {
        title: "Prepaid Rate",
        value: formatPercent(metrics.prepaidRate),
        icon: "solar:bill-list-bold-duotone",
        iconColor: "text-default-500",
        tooltip: "Percentage of orders marked as paid during the selected period.",
      },
      {
        title: "Repeat Rate",
        value: formatPercent(metrics.repeatRate),
        icon: "solar:refresh-circle-bold-duotone",
        iconColor: "text-default-500",
        tooltip:
          "Share of customers who returned to buy again in the selected window.",
      },
      {
        title: "Abandoned Customers",
        value: `${formatInteger(metrics.abandonedCartCustomers)} (${formatPercent(metrics.abandonedRate)})`,
        icon: "solar:cart-cross-bold-duotone",
        iconColor: "text-default-500",
        tooltip:
          "Customers created in this window who haven't completed an order yet.",
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
          iconColor={item.iconColor}
          size="small"
          title={item.title}
          tooltip={item.tooltip}
          value={item.value}
        />
      ))}
    </div>
  );
});
