"use client";

import { WidgetSkeleton } from "@/components/shared/skeletons";
import { WidgetRenderer } from "./WidgetRenderer";

type OverviewMetricView = { value: number; change?: number };
type OverviewMetricsView = Record<string, OverviewMetricView>;

interface WidgetsContainerProps {
  widgets: string[];
  metricsData: Record<string, number>;
  overviewMetrics: OverviewMetricsView | null;
  primaryCurrency: string;
  showCostSetupWarning: boolean;
  isLoading: boolean;
}

export function WidgetsContainer({
  widgets,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  showCostSetupWarning,
  isLoading,
}: WidgetsContainerProps) {
  const displayWidgets = Array.isArray(widgets) ? widgets : [];
  const showSkeletons = isLoading && displayWidgets.length > 0;

  const getWrapperClass = (widgetId: string) =>
    widgetId === "costBreakdown"
      ? "h-full lg:col-span-2 xl:col-span-2"
      : "h-full";

  if (displayWidgets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Analytics Widgets</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {showSkeletons
            ? displayWidgets.map((widgetId) => (
                <div key={`skeleton-${widgetId}`} className={getWrapperClass(widgetId)}>
                  <WidgetSkeleton
                    variant={widgetId === "costBreakdown" ? "large" : "default"}
                  />
                </div>
              ))
            : displayWidgets.map((widgetId) => (
                <div key={widgetId} className={getWrapperClass(widgetId)}>
                  <WidgetRenderer
                    isLoading={false}
                    metricsData={metricsData}
                    overviewMetrics={overviewMetrics}
                    primaryCurrency={primaryCurrency}
                    showCostSetupWarning={showCostSetupWarning}
                    widgetId={widgetId}
                  />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
