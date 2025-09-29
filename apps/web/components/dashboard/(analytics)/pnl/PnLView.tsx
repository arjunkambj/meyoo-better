"use client";

import { Spacer } from "@heroui/react";
import { memo, useCallback, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { usePnLAnalytics } from "@/hooks";
import { PnLKPICards } from "./components/PnLKPICards";
import { PnLTable } from "./components/PnLTable";

export const PnLView = memo(function PnLView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    };
  });

  const {
    metricsData,
    tablePeriods,
    granularity,
    setGranularity,
    loadingStates,
    exportData,
  } = usePnLAnalytics(dateRange);

  const handleAnalyticsRangeChange = useCallback((range: { startDate: string; endDate: string }) => {
    setDateRange({ startDate: range.startDate, endDate: range.endDate });
  }, []);

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <GlobalDateRangePicker
            defaultPreset="last_30_days"
            onAnalyticsChange={handleAnalyticsRangeChange}
          />
        }
        rightActions={
          <ExportButton
            data={exportData}
            filename="pnl-report"
            formats={["csv", "pdf"]}
            color="primary"
          />
        }
      />

      <PnLKPICards metrics={metricsData} isLoading={loadingStates.metrics} />

      {/* P&L Table with integrated granularity controls */}
      <PnLTable
        granularity={granularity}
        setGranularity={setGranularity}
        loading={loadingStates.table}
        periods={tablePeriods}
      />
    </div>
  );
});
