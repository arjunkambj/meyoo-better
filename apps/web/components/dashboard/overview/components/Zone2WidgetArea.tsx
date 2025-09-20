"use client";

import { WidgetSkeleton } from "@/components/shared/skeletons";

type OverviewMetricView = { value: number; change?: number };
type OverviewMetricsView = Record<string, OverviewMetricView>;

import { WidgetRenderer } from "./WidgetRenderer";

interface Zone2WidgetAreaProps {
  zone2Items: string[];
  metricsData: Record<string, number>;
  overviewMetrics: OverviewMetricsView | null;
  primaryCurrency: string;
  showCostSetupWarning: boolean;
  isLoading: boolean;
}

export function Zone2WidgetArea({
  zone2Items,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  showCostSetupWarning,
  isLoading,
}: Zone2WidgetAreaProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Analytics Widgets</h2>
        <div className="space-y-4">
          {/* Cost Breakdown skeleton */}
          <WidgetSkeleton variant="large" />

          {/* Other widgets skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <WidgetSkeleton />
            <WidgetSkeleton />
            <WidgetSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Analytics Widgets</h2>
      <div className="space-y-4">
        {/* Cost Breakdown takes full width */}
        {zone2Items?.map((widgetId: string) => {
          if (widgetId === "costBreakdown") {
            return (
              <div key={widgetId} className="w-full">
                <WidgetRenderer
                  isLoading={false}
                  metricsData={metricsData}
                  overviewMetrics={overviewMetrics}
                  primaryCurrency={primaryCurrency}
                  showCostSetupWarning={showCostSetupWarning}
                  widgetId={widgetId}
                />
              </div>
            );
          }

          return null;
        })}

        {/* Grid for non-costBreakdown widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {zone2Items?.map((widgetId: string) => {
            if (widgetId === "costBreakdown") return null;

            return (
              <WidgetRenderer
                key={widgetId}
                isLoading={false}
                metricsData={metricsData}
                overviewMetrics={overviewMetrics}
                primaryCurrency={primaryCurrency}
                showCostSetupWarning={showCostSetupWarning}
                widgetId={widgetId}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
