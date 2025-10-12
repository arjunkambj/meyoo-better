"use client";

import { Spacer } from "@heroui/react";
import { memo } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useAnalyticsDateRange, usePnLAnalytics } from "@/hooks";
import { PnLKPICards } from "./components/PnLKPICards";
import { PnLTable } from "./components/PnLTable";

export const PnLView = memo(function PnLView() {
  const {
    analyticsRange: pnlRange,
    calendarRange: pnlCalendarRange,
    preset: pnlPreset,
    updateRange: updatePnlRange,
  } = useAnalyticsDateRange('dashboard-pnl', { defaultPreset: 'today', sharedKey: null });

  const {
    metricsData,
    tablePeriods,
    granularity,
    setGranularity,
    loadingStates,
    dateRange: analyticsDateRange,
    primaryCurrency,
    tableRange,
  } = usePnLAnalytics(pnlRange);

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <GlobalDateRangePicker
            value={pnlCalendarRange}
            preset={pnlPreset}
            defaultPreset="today"
            onAnalyticsChange={updatePnlRange}
          />
        }
        rightActions={null}
      />

      <PnLKPICards
        metrics={metricsData}
        isLoading={loadingStates.metrics}
        primaryCurrency={primaryCurrency}
      />

      {/* P&L Table with integrated granularity controls */}
      <PnLTable
        dateRange={analyticsDateRange}
        granularity={granularity}
        setGranularity={setGranularity}
        loading={loadingStates.table}
        periods={tablePeriods}
        primaryCurrency={primaryCurrency}
        tableRange={tableRange}
      />
    </div>
  );
});
