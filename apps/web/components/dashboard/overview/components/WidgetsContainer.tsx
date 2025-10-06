"use client";

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
  const getWrapperClass = (widgetId: string) =>
    widgetId === "costBreakdown"
      ? "h-full col-span-full"
      : "h-full";

  if (displayWidgets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Analytics Widgets</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayWidgets.map((widgetId) => (
            <div key={widgetId} className={getWrapperClass(widgetId)}>
              <WidgetRenderer
                isLoading={isLoading}
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
