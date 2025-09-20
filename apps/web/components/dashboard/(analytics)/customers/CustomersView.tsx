"use client";

import { Spacer } from "@heroui/react";
import { memo, useCallback, useState } from "react";

import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useCustomerAnalytics } from "@/hooks";

import { CustomerTable } from "../customer-insights/components/CustomerTable";

export const CustomersView = memo(function CustomersView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();

  const { customers, loadingStates, exportData } = useCustomerAnalytics(dateRange);

  const handleAnalyticsRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange({ startDate: range.start, endDate: range.end });
    },
    [],
  );

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <GlobalDateRangePicker
            onAnalyticsChange={handleAnalyticsRangeChange}
          />
        }
        rightActions={
          <ExportButton
            color="primary"
            data={exportData}
            disabled={loadingStates.customers}
            filename="customers-database"
            formats={["csv", "excel", "pdf"]}
          />
        }
      />

      <CustomerTable
        customers={customers?.data || []}
        loading={loadingStates.customers}
        pagination={customers?.pagination}
      />
    </div>
  );
});

CustomersView.displayName = "CustomersView";
