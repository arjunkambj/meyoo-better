"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { memo, useCallback, useMemo } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
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
    exportData,
    loading,
  } = useOrdersInsights({
    dateRange: ordersInsightsRange,
  });

  const handleAnalyticsRangeChange = useCallback(updateOrdersInsightsRange, [updateOrdersInsightsRange]);

  const isExportDisabled = useMemo(
    () => loading || exportData.length === 0,
    [loading, exportData],
  );

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
        rightActions={
          <ExportButton
            color="primary"
            data={exportData.map((row) => ({ ...row }))}
            disabled={isExportDisabled}
            filename="orders-insights"
            formats={["csv", "pdf"]}
          />
        }
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
