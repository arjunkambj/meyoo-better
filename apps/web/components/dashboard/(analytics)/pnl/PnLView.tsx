"use client";

import { Button, Skeleton, Spacer, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CalendarDate } from "@internationalized/date";
import { memo, useCallback, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { type PnLGranularity, usePnLAnalytics } from "@/hooks";
import { PnLKPICards } from "./components/PnLKPICards";
import { PnLTable } from "./components/PnLTable";

// Helper to convert CalendarDate to string
const _calendarDateToString = (date: CalendarDate): string => {
  const year = date.year;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const PnLView = memo(function PnLView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();

  const {
    kpiMetrics,
    tablePeriods,
    granularity,
    setGranularity,
    loadingStates,
  } = usePnLAnalytics(dateRange);

  const handleAnalyticsRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange({ startDate: range.start, endDate: range.end });
    },
    []
  );

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header with Date Range Picker and Granularity Tabs */}
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <div className="flex items-center gap-4">
            <GlobalDateRangePicker
              onAnalyticsChange={handleAnalyticsRangeChange}
            />
            <Tabs
              aria-label="P&L granularity"
              classNames={{
                tabList: "gap-2",
                cursor: "w-full bg-primary",
                tab: "max-w-fit px-3 h-9",
                tabContent: "group-data-[selected=true]:text-primary",
              }}
              color="primary"
              selectedKey={granularity}
              variant="underlined"
              onSelectionChange={(key) => setGranularity(key as PnLGranularity)}
            >
              <Tab key="monthly" title="Monthly" />
              <Tab key="weekly" title="Weekly" />
              <Tab key="daily" title="Daily" />
            </Tabs>
          </div>
        }
        rightActions={
          <Button
            color="primary"
            startContent={<Icon icon="solar:export-bold-duotone" width={16} />}
          >
            Export
          </Button>
        }
      />

      {/* KPI Cards */}
      {loadingStates.metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <PnLKPICards metrics={kpiMetrics} />
      )}
      {/* P&L Table */}
      <PnLTable
        granularity={granularity}
        loading={loadingStates.table}
        periods={tablePeriods}
      />
    </div>
  );
});
