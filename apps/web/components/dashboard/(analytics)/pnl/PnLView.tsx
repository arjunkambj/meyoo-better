"use client";

import { Spacer } from "@heroui/react";
import { memo, useCallback, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { usePnLAnalytics } from "@/hooks";
import { PnLTable } from "./components/PnLTable";

export const PnLView = memo(function PnLView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();

  const {
    tablePeriods,
    granularity,
    setGranularity,
    loadingStates,
    exportData,
  } = usePnLAnalytics(dateRange);

  const handleAnalyticsRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange({ startDate: range.start, endDate: range.end });
    },
    []
  );

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <GlobalDateRangePicker
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
