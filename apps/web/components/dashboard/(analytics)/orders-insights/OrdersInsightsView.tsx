"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { memo, useCallback, useMemo, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useCustomerAnalytics, useOrdersAnalytics } from "@/hooks";
import { OrdersOverviewCards } from "../orders/components/OrdersOverviewCards";
import { CohortAnalysis } from "./components/CohortAnalysis";
import { FulfillmentAnalysis } from "./components/FulfillmentAnalysis";
import { GeographicDistribution } from "./components/GeographicDistribution";

export const OrdersInsightsView = memo(function OrdersInsightsView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();

  const {
    overview,
    fulfillmentMetrics,
    exportData,
    loadingStates: ordersLoading,
  } = useOrdersAnalytics({
    dateRange,
  });

  const {
    cohorts,
    geographic,
    loadingStates: customerLoading,
  } = useCustomerAnalytics(dateRange);

  const handleAnalyticsRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange({ startDate: range.start, endDate: range.end });
    },
    [],
  );

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
            onAnalyticsChange={handleAnalyticsRangeChange}
          />
        }
        rightActions={
          <ExportButton
            color="primary"
            data={exportData}
            disabled={isExportDisabled}
            filename="orders-insights"
            formats={["csv", "excel", "pdf"]}
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
        {customerLoading.geographic ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : (
          <GeographicDistribution data={geographic} />
        )}
        {customerLoading.cohorts ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : (
          <CohortAnalysis cohorts={cohorts} />
        )}
      </div>

      {ordersLoading.fulfillment ? (
        <Skeleton className="h-[350px] rounded-lg" />
      ) : (
        <FulfillmentAnalysis metrics={fulfillmentMetrics} />
      )}
    </div>
  );
});

OrdersInsightsView.displayName = "OrdersInsightsView";
