"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { memo, useCallback, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useCustomerAnalytics, useOrdersAnalytics } from "@/hooks";
import { CustomerJourney } from "./components/CustomerJourney";
import { CustomerOverviewCards } from "./components/CustomerOverviewCards";

export const CustomerInsightsView = memo(function CustomerInsightsView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();

  const {
    overview,
    journey,
    isInitialLoading,
    loadingStates,
    exportData,
  } = useCustomerAnalytics(dateRange);

  // Fetch order metrics for cancel and return rates
  const { fulfillmentMetrics, orderOverview } = useOrdersAnalytics({
    dateRange,
  });

  const cancelRate =
    orderOverview && orderOverview.totalOrders > 0
      ? (orderOverview.cancelledOrders / orderOverview.totalOrders) * 100
      : 0;

  const handleAnalyticsRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange({ startDate: range.start, endDate: range.end });
    },
    [],
  );

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header - Always visible */}
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
            disabled={isInitialLoading}
            filename="customers"
            formats={["csv", "pdf"]}
          />
        }
      />

      {/* Overview Cards */}
      {loadingStates.overview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <CustomerOverviewCards metrics={overview} />
      )}

      {/* Customer Journey */}
      {loadingStates.journey ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        <CustomerJourney
          cancelRate={cancelRate}
          data={journey}
          returnRate={fulfillmentMetrics?.returnRate || 0}
        />
      )}
    </div>
  );
});

CustomerInsightsView.displayName = "CustomerInsightsView";
