"use client";

import { Skeleton } from "@heroui/skeleton";
import { Spacer } from "@heroui/spacer";
import { memo, useCallback } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useAnalyticsDateRange, useOrdersInsights } from "@/hooks";
import { OrdersInsightsKPICards } from "./components/OrdersInsightsKPICards";
import { CustomerJourney } from "./components/CustomerJourney";
import { FulfillmentAnalysis } from "./components/FulfillmentAnalysis";

export const OrdersInsightsView = memo(function OrdersInsightsView() {
  const {
    analyticsRange: ordersInsightsRange,
    calendarRange: ordersInsightsCalendarRange,
    preset: ordersInsightsPreset,
    updateRange: updateOrdersInsightsRange,
  } = useAnalyticsDateRange('dashboard-orders-insights', { defaultPreset: 'today', sharedKey: null });

  const {
    kpis,
    fulfillment,
    journey,
    cancelRate,
    returnRate,
    loading,
  } = useOrdersInsights({
    dateRange: ordersInsightsRange,
  });

  const handleAnalyticsRangeChange = useCallback(updateOrdersInsightsRange, [updateOrdersInsightsRange]);

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <GlobalDateRangePicker
            value={ordersInsightsCalendarRange}
            preset={ordersInsightsPreset}
            onAnalyticsChange={handleAnalyticsRangeChange}
          />
        }
        rightActions={null}
      />

      <OrdersInsightsKPICards kpis={kpis} loading={loading} />

      {loading ? (
        <Skeleton className="h-[360px] rounded-2xl" />
      ) : (
        <CustomerJourney cancelRate={cancelRate} data={journey} returnRate={returnRate} />
      )}

      {loading ? (
        <Skeleton className="h-[360px] rounded-2xl" />
      ) : (
        <FulfillmentAnalysis metrics={fulfillment ?? undefined} />
      )}
    </div>
  );
});

OrdersInsightsView.displayName = "OrdersInsightsView";
