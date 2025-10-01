"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { lazy, memo, Suspense, useCallback, useMemo } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useAnalyticsDateRange, useCustomerAnalytics, useOrdersAnalytics } from "@/hooks";
import { OrdersOverviewCards } from "../orders/components/OrdersOverviewCards";

// Lazy load heavy chart components
const CohortAnalysis = lazy(() =>
  import("./components/CohortAnalysis").then(mod => ({ default: mod.CohortAnalysis }))
);
const FulfillmentAnalysis = lazy(() =>
  import("./components/FulfillmentAnalysis").then(mod => ({ default: mod.FulfillmentAnalysis }))
);
const GeographicDistribution = lazy(() =>
  import("./components/GeographicDistribution").then(mod => ({ default: mod.GeographicDistribution }))
);

export const OrdersInsightsView = memo(function OrdersInsightsView() {
  const {
    analyticsRange: ordersInsightsRange,
    calendarRange: ordersInsightsCalendarRange,
    preset: ordersInsightsPreset,
    updateRange: updateOrdersInsightsRange,
  } = useAnalyticsDateRange('dashboard-orders-insights', { defaultPreset: 'today' });

  const {
    overview,
    fulfillmentMetrics,
    exportData,
    loadingStates: ordersLoading,
  } = useOrdersAnalytics({
    dateRange: ordersInsightsRange,
  });

  const {
    cohorts,
    geographic,
    loadingStates: customerLoading,
  } = useCustomerAnalytics(ordersInsightsRange);

  const handleAnalyticsRangeChange = useCallback(updateOrdersInsightsRange, [updateOrdersInsightsRange]);

  const isExportDisabled = useMemo(
    () =>
      ordersLoading.overview ||
      ordersLoading.fulfillment ||
      customerLoading.cohorts ||
      customerLoading.geographic,
    [customerLoading.cohorts, customerLoading.geographic, ordersLoading.fulfillment, ordersLoading.overview],
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

      {ordersLoading.overview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={`orders-overview-skeleton-${index}`} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <OrdersOverviewCards metrics={overview} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          {customerLoading.geographic ? (
            <Skeleton className="h-96 rounded-lg" />
          ) : (
            <GeographicDistribution data={geographic} />
          )}
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          {customerLoading.cohorts ? (
            <Skeleton className="h-96 rounded-lg" />
          ) : (
            <CohortAnalysis cohorts={cohorts} />
          )}
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-[350px] rounded-lg" />}>
        {ordersLoading.fulfillment ? (
          <Skeleton className="h-[350px] rounded-lg" />
        ) : (
          <FulfillmentAnalysis metrics={fulfillmentMetrics} />
        )}
      </Suspense>
    </div>
  );
});

OrdersInsightsView.displayName = "OrdersInsightsView";
