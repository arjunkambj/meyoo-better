"use client";

import { Spacer } from "@heroui/react";
import { memo, useCallback, useMemo, useState } from "react";

import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import { useCustomerAnalytics } from "@/hooks";

import { CustomerTable } from "../customer-insights/components/CustomerTable";

const STATUS_FILTERS = [
  { value: "all", label: "All Customers" },
  { value: "converted", label: "Converted" },
  { value: "abandoned_cart", label: "Abandoned Cart" },
];

export const CustomersView = memo(function CustomersView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { customers, loadingStates, exportData } = useCustomerAnalytics(dateRange);

  const filters = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select" as const,
        options: STATUS_FILTERS,
      },
    ],
    []
  );

  const filterValues = useMemo(
    () => ({
      status: statusFilter,
    }),
    [statusFilter]
  );

  const handleAnalyticsRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange({ startDate: range.start, endDate: range.end });
    },
    []
  );

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    if (key === "status") {
      setStatusFilter((value as string) || "all");
    }
  }, []);

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <div className="flex flex-wrap items-center gap-3">
            <GlobalDateRangePicker onAnalyticsChange={handleAnalyticsRangeChange} />
            <FilterBar
              filters={filters}
              values={filterValues}
              onFilterChange={handleFilterChange}
            />
          </div>
        }
        rightActions={
          <ExportButton
            color="primary"
            data={exportData}
            disabled={loadingStates.customers}
            filename="customers-database"
            formats={["csv", "pdf"]}
          />
        }
      />

      <CustomerTable
        customers={customers?.data || []}
        loading={loadingStates.customers}
        pagination={customers?.pagination}
        statusFilter={statusFilter}
      />
    </div>
  );
});

CustomersView.displayName = "CustomersView";
