"use client";

import React from "react";

import KPI from "@/components/shared/cards/KPI";
import { PinnedMetricsGridSkeleton } from "@/components/shared/skeletons";
import { formatMetricValue, METRICS } from "../metrics/registry";
import { useAtomValue } from "jotai";
import { agentSidebarOpenAtom } from "@/store/atoms";
import { cn } from "@heroui/theme";

type OverviewMetricView = { value: number; change?: number };
type OverviewMetricsView = Record<string, OverviewMetricView>;

interface MetricsContainerProps {
  metrics: string[];
  metricsData: Record<string, number | string>;
  overviewMetrics: OverviewMetricsView | null;
  primaryCurrency: string;
  isLoading: boolean;
}

// Default KPI metrics if none are selected
const DEFAULT_METRICS = [
  "netProfit",
  "revenue",
  "netProfitMargin",
  "orders",
  "avgOrderValue",
  "blendedRoas", // MER
  "totalAdSpend",
  "shopifyConversionRate",
  "repeatCustomerRate",
  "moMRevenueGrowth",
];

export function MetricsContainer({
  metrics,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  isLoading,
}: MetricsContainerProps) {
  const isAgentSidebarOpen = useAtomValue(agentSidebarOpenAtom);

  // Use provided metrics or default metrics if none provided
  const displayMetrics = React.useMemo(() => {
    if (metrics.length === 0) {
      return DEFAULT_METRICS;
    }
    return metrics;
  }, [metrics]);

  const renderMetricCard = (metricId: string, index: number) => {
    const metric = METRICS[metricId];

    if (!metric) {
      return null;
    }

    const rawValue = metricsData[metricId as keyof typeof metricsData];
    const value = typeof rawValue === "number" ? rawValue : 0;
    const formattedValue = formatMetricValue(value, metric, primaryCurrency);

    // Get change data from the metrics
    const metricData = overviewMetrics?.[metricId];
    const change =
      typeof metricData === "object" && "change" in metricData
        ? (metricData.change as number)
        : 0;
    const roundedChange = Math.round(change * 10) / 10;

    return (
      <KPI
        key={`metric-${metricId}-${index}`}
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
  };

  if (isLoading) {
    return <PinnedMetricsGridSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
        isAgentSidebarOpen
          ? "xl:grid-cols-3 2xl:grid-cols-4"
          : "xl:grid-cols-4 2xl:grid-cols-5"
      )}>
        {displayMetrics.map((metricId, index) =>
          renderMetricCard(metricId, index)
        )}
      </div>
    </div>
  );
}
