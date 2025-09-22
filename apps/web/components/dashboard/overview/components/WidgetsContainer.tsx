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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Analytics Widgets</h2>
      <div className="space-y-4">
        {showSkeletons ? (
          <>
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
          </>
        ) : displayWidgets.length === 0 ? (
          <EmptyState />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-medium border border-dashed border-divider py-16 text-center text-default-400">
      <p className="text-sm font-medium">No widgets selected</p>
      <p className="text-xs mt-1 max-w-xs">
        Use Customize Dashboard to add widgets or reset to the default layout.
      </p>
    </div>
  );
}
