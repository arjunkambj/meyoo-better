"use client";

import { useMemo } from "react";

import KPI, { KPISkeleton } from "@/components/shared/cards/KPI";
import { useUser } from "@/hooks";
import { getCurrencySymbol, formatNumber } from "@/libs/utils/format";
import type { OrdersInsightsKPIs } from "@repo/types";

interface OrdersInsightsKPICardsProps {
  kpis: OrdersInsightsKPIs | null;
  loading?: boolean;
}

const formatPercent = (value: number) =>
  `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;

export function OrdersInsightsKPICards({
  kpis,
  loading = false,
}: OrdersInsightsKPICardsProps) {
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  const items = useMemo(() => {
    if (!kpis) return [];

    const formatCurrencyValue = (value: number) =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);

    return [
      {
        title: "Prepaid Rate",
        value: formatPercent(kpis.prepaidRate.value),
        change: kpis.prepaidRate.change,
        icon: "solar:bill-list-bold-duotone",
        iconColor: "text-primary",
        tooltip: "Percentage of orders paid upfront within the selected range.",
      },
      {
        title: "Repeat Rate",
        value: formatPercent(kpis.repeatRate.value),
        change: kpis.repeatRate.change,
        icon: "solar:refresh-circle-bold-duotone",
        iconColor: "text-success",
        tooltip: "Share of customers who returned to place another order.",
      },
      {
        title: "Return/RTO Revenue Loss",
        value: `${currencySymbol}${formatCurrencyValue(kpis.rtoRevenueLoss.value)}`,
        change: kpis.rtoRevenueLoss.change,
        icon: "solar:cart-cross-bold-duotone",
        iconColor: "text-danger",
        tooltip: "Revenue lost due to returns or RTO orders.",
      },
      {
        title: "Abandoned Customers",
        value: formatNumber(kpis.abandonedCustomers.value),
        change: kpis.abandonedCustomers.change,
        icon: "solar:user-hand-up-bold-duotone",
        iconColor: "text-warning",
        tooltip: "Customers who were acquired but did not complete a purchase.",
      },
      {
        title: "Fulfillment Rate",
        value: formatPercent(kpis.fulfillmentRate.value),
        change: kpis.fulfillmentRate.change,
        icon: "solar:delivery-bold-duotone",
        iconColor: "text-default-500",
        tooltip: "Percentage of orders successfully fulfilled.",
      },
    ];
  }, [
    currencySymbol,
    kpis,
  ]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <KPISkeleton key={`orders-insights-kpi-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <KPISkeleton key={`orders-insights-kpi-empty-${index}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <KPI
          key={item.title}
          change={item.change}
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
}
