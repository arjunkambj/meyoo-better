"use client";

import KPI from "@/components/shared/cards/KPI";
import { UnpinnedMetricsSkeleton } from "@/components/shared/skeletons";

type OverviewMetricView = { value: number; change?: number };
type OverviewMetricsView = Record<string, OverviewMetricView>;

import { formatMetricValue, METRICS } from "../metrics/registry";

interface UnpinnedMetricsProps {
  metrics: string[]; // Metrics beyond the first 10
  metricsData: Record<string, number | string>;
  overviewMetrics: OverviewMetricsView | null;
  primaryCurrency: string;
  isLoading: boolean;
}

export function UnpinnedMetrics({
  metrics,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  isLoading,
}: UnpinnedMetricsProps) {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  if (isLoading) {
    return <UnpinnedMetricsSkeleton count={metrics.length} />;
  }

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Key Performance Indicators</h2>
        <span className="text-xs text-default-500">
          ({metrics.length} additional)
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
        {metrics.map((metricId: string) => {
          const metric = METRICS[metricId];

          if (!metric) return null;

          const rawValue = metricsData[metricId as keyof typeof metricsData];
          const value = typeof rawValue === "number" ? rawValue : 0;
          const formattedValue = formatMetricValue(
            value,
            metric,
            primaryCurrency,
          );

          // Get real change data from the metrics
          const metricData = overviewMetrics?.[metricId];
          const change =
            typeof metricData === "object" && "change" in metricData
              ? (metricData.change as number)
              : 0;
          const roundedChange = Math.round(change * 10) / 10;

          return (
            <KPI
              key={`metric-${metricId}`}
              change={roundedChange}
              changeType={
                roundedChange > 0
                  ? "positive"
                  : roundedChange < 0
                    ? "negative"
                    : "neutral"
              }
              icon={metric.icon}
              iconColor={metric.iconColor}
              loading={false}
              title={metric.label}
              value={formattedValue}
            />
          );
        })}
      </div>
    </div>
  );
}
