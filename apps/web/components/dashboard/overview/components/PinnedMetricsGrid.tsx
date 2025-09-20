"use client";

import React from "react";

import KPI from "@/components/shared/cards/KPI";
import { PinnedMetricsGridSkeleton } from "@/components/shared/skeletons";

type OverviewMetricView = { value: number; change?: number };
type OverviewMetricsView = Record<string, OverviewMetricView>;

import { formatMetricValue, METRICS } from "../metrics/registry";

interface PinnedMetricsGridProps {
  metrics: string[]; // Can be less than 10
  metricsData: Record<string, number | string>;
  overviewMetrics: OverviewMetricsView | null;
  primaryCurrency: string;
  isLoading: boolean;
  maxVisible?: number; // default 10; set to 8 for lg behavior
}

// Default fallback metrics if less than 10 are selected
const FALLBACK_METRICS = [
  "grossProfit",
  "grossProfitMargin",
  "unitsSold",
  "cogs",
  "shippingCosts",
];

export function PinnedMetricsGrid({
  metrics,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  isLoading,
  maxVisible = 10,
}: PinnedMetricsGridProps) {
  // Always ensure we have exactly 10 metrics
  const pinnedMetrics = React.useMemo(() => {
    const target = Math.max(0, Math.min(maxVisible, 10));
    const result = [...metrics.slice(0, target)];

    // Fill with fallback metrics if less than 10
    if (result.length < target) {
      const availableFallbacks = FALLBACK_METRICS.filter(
        (m) => !result.includes(m)
      );
      const needed = target - result.length;

      result.push(...availableFallbacks.slice(0, needed));
    }

    // If still less than 10, fill with empty slots
    while (result.length < target) {
      result.push(`empty-${result.length}`);
    }

    return result;
  }, [metrics, maxVisible]);

  // Split metrics into two rows
  const firstRowMetrics = pinnedMetrics.slice(0, 5);
  const secondRowMetrics = pinnedMetrics.slice(5, maxVisible);

  const renderMetricCard = (
    metricId: string,
    index: number,
    isSecondRow: boolean = false
  ) => {
    // Handle empty slots
    if (metricId.startsWith("empty-")) {
      const visibility = !isSecondRow ? (index === 4 ? "hidden 2xl:flex" : "") : "";
      return (
        <div
          key={`empty-${index}`}
          className={
            isSecondRow
              ? "basis-1/2 lg:basis-1/4 2xl:basis-1/5 min-w-0 py-2"
              : `h-[120px] rounded-2xl bg-content2 dark:bg-content1 border border-default-200/50 flex items-center justify-center ${visibility}`
          }
        >
          {!isSecondRow && (
            <span className="text-default-400 text-sm">No metric</span>
          )}
        </div>
      );
    }

    const metric = METRICS[metricId];

    if (!metric) {
      const visibility = !isSecondRow ? (index === 4 ? "hidden 2xl:flex" : "") : "";
      return (
        <div
          key={`invalid-${index}`}
          className={
            isSecondRow
              ? "basis-1/2 lg:basis-1/4 2xl:basis-1/5 min-w-0 py-2"
              : `h-[120px] rounded-2xl bg-content2 dark:bg-content1 border border-default-200/50 flex items-center justify-center ${visibility}`
          }
        >
          {!isSecondRow && (
            <span className="text-default-400 text-sm">N/A</span>
          )}
        </div>
      );
    }

    const rawValue = metricsData[metricId as keyof typeof metricsData];
    const value = typeof rawValue === "number" ? rawValue : 0;
    const formattedValue = formatMetricValue(value, metric, primaryCurrency);

    // Get real change data from the metrics
    const metricData = overviewMetrics?.[metricId];
    const change =
      typeof metricData === "object" && "change" in metricData
        ? (metricData.change as number)
        : 0;
    const roundedChange = Math.round(change * 10) / 10;

    // For second row, create a more compact layout without using KPI component
    if (isSecondRow) {
      const _isLastItem = index === 9; // Last item in second row (index 5-9, so 9 is last)

      return (
        <div
          key={`metric-${metricId}`}
          className={
            "basis-1/2 lg:basis-1/4 2xl:basis-1/5 min-w-0 flex flex-col justify-center h-[125px] py-5 px-4"
          }
        >
          <div className="text-sm text-default-800 font-medium mb-1.5">
            {metric.label}
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mb-2">
            {formattedValue}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-default-600">vs last period</span>
            <span
              className={`text-xs font-semibold flex items-center gap-0.5 ${
                roundedChange > 0
                  ? "text-success"
                  : roundedChange < 0
                    ? "text-danger"
                    : "text-warning"
              }`}
            >
              {roundedChange > 0 ? "↑" : roundedChange < 0 ? "↓" : ""}
              {roundedChange > 0 ? "+" : ""}
              {roundedChange.toFixed(1)}%
            </span>
          </div>
        </div>
      );
    }

    const visibility = !isSecondRow && index === 4 ? "hidden 2xl:block" : "";
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
        className={visibility}
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
    <div className="space-y-6">
      {/* First Row - Show 4 on lg, 5 on 2xl (5th hidden below 2xl) */}
      <div className="grid grid-cols-4 2xl:grid-cols-5 gap-4">
        {firstRowMetrics.map((metricId, index) =>
          renderMetricCard(metricId, index, false)
        )}
      </div>

      {/* Second Row - Shared border container with unified card background */}
      <div className="border border-default-200/50 rounded-2xl py-1 bg-content2 dark:bg-content1">
        <div className="flex flex-wrap items-stretch">
          {/* Move the 5th metric here for <2xl; allow wrapping to avoid hiding */}
          <div className="basis-1/2 lg:basis-1/4 2xl:basis-1/5 min-w-0 block 2xl:hidden">
            {renderMetricCard(firstRowMetrics[4] ?? `empty-4`, 4, true)}
          </div>
          {secondRowMetrics.map((metricId, index) =>
            renderMetricCard(metricId, index + 5, true)
          )}
        </div>
      </div>
    </div>
  );
}
