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

// Default widgets if none are selected
const DEFAULT_WIDGETS = [
  "adSpendSummary",
  "customerSummary",
  "orderSummary",
];

export function WidgetsContainer({
  widgets,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  showCostSetupWarning,
  isLoading,
}: WidgetsContainerProps) {
  // Use provided widgets or default widgets if none provided
  const displayWidgets = widgets.length > 0 ? widgets : DEFAULT_WIDGETS;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Analytics Widgets</h2>
        <div className="space-y-4">
          {/* Check if costBreakdown is included */}
          {displayWidgets.includes("costBreakdown") && (
            <WidgetSkeleton variant="large" />
          )}

          {/* Other widgets skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayWidgets
              .filter((w) => w !== "costBreakdown")
              .map((_, index) => (
                <WidgetSkeleton key={index} />
              ))}
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
        {displayWidgets.includes("costBreakdown") && (
          <div className="w-full">
            <WidgetRenderer
              isLoading={false}
              metricsData={metricsData}
              overviewMetrics={overviewMetrics}
              primaryCurrency={primaryCurrency}
              showCostSetupWarning={showCostSetupWarning}
              widgetId="costBreakdown"
            />
          </div>
        )}

        {/* Grid for non-costBreakdown widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayWidgets
            .filter((widgetId) => widgetId !== "costBreakdown")
            .map((widgetId) => (
              <WidgetRenderer
                key={widgetId}
                isLoading={false}
                metricsData={metricsData}
                overviewMetrics={overviewMetrics}
                primaryCurrency={primaryCurrency}
                showCostSetupWarning={showCostSetupWarning}
                widgetId={widgetId}
              />
            ))}
        </div>
      </div>
    </div>
  );
}