"use client";

import React, { useMemo } from "react";

type OverviewMetricView = { value: number; change?: number };
type OverviewMetricsView = Record<string, OverviewMetricView>;

import { PinnedMetricsGrid } from "./PinnedMetricsGrid";
import { UnpinnedMetrics } from "./UnpinnedMetrics";
import { useMediaQuery } from "@/hooks";

interface Zone1KPIGridProps {
  zone1Items: string[];
  metricsData: Record<string, number | string>;
  overviewMetrics: OverviewMetricsView | null;
  primaryCurrency: string;
  isLoading: boolean;
}

export const Zone1KPIGrid = React.memo(function Zone1KPIGrid({
  zone1Items,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  isLoading,
}: Zone1KPIGridProps) {
  const is2xl = useMediaQuery("(min-width: 1536px)");
  const pinnedCount = is2xl ? 10 : 8;

  // Split metrics into pinned (first 10) and unpinned (rest)
  const pinnedMetrics = useMemo(
    () => zone1Items.slice(0, pinnedCount),
    [zone1Items, pinnedCount],
  );
  const unpinnedMetrics = useMemo(
    () => zone1Items.slice(pinnedCount),
    [zone1Items, pinnedCount],
  );

  return (
    <>
      {/* Pinned Metrics - 8 on lg (4+4), 10 on 2xl (5+5) */}
      <PinnedMetricsGrid
        isLoading={isLoading}
        metrics={pinnedMetrics}
        maxVisible={pinnedCount}
        metricsData={metricsData}
        overviewMetrics={overviewMetrics}
        primaryCurrency={primaryCurrency}
      />

      {/* Unpinned Metrics - Shows additional metrics if any */}
      {unpinnedMetrics.length > 0 && (
        <UnpinnedMetrics
          isLoading={isLoading}
          metrics={unpinnedMetrics}
          metricsData={metricsData}
          overviewMetrics={overviewMetrics}
          primaryCurrency={primaryCurrency}
        />
      )}
    </>
  );
});
