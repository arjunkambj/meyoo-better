"use client";

import { Spacer } from "@heroui/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import { useAnalyticsDateRange, useCustomerAnalytics } from "@/hooks";

import { CustomerTable } from "./components/CustomerTable";

const STATUS_FILTERS = [
  { value: "all", label: "All Customers" },
  { value: "converted", label: "Converted" },
  { value: "abandoned_cart", label: "Abandoned Cart" },
];

export const CustomersView = memo(function CustomersView() {
  const {
    analyticsRange: customersRange,
    calendarRange: customersCalendarRange,
    preset: customersPreset,
    updateRange: updateCustomersRange,
  } = useAnalyticsDateRange('dashboard-customers', { defaultPreset: 'today', sharedKey: null });
  const [statusFilter, setStatusFilter] = useState<"all" | "converted" | "abandoned_cart">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { customers, metadata, isLoading, isRefreshing } = useCustomerAnalytics({
    dateRange: customersRange,
    status: statusFilter,
    page: currentPage,
  });

  useEffect(() => {
    const resolvedPage = customers?.pagination?.page;
    if (typeof resolvedPage === "number" && resolvedPage !== currentPage) {
      setCurrentPage(resolvedPage);
    }
  }, [customers?.pagination?.page, currentPage]);

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
    (...args: Parameters<typeof updateCustomersRange>) => {
      setCurrentPage(1);
      return updateCustomersRange(...args);
    },
    [updateCustomersRange],
  );

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    if (key === "status") {
      setCurrentPage(1);
      setStatusFilter((value as "all" | "converted" | "abandoned_cart") || "all");
    }
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    if (!metadata?.computedAt) {
      return "Never";
    }
    const date = new Date(metadata.computedAt);
    return date.toLocaleString();
  }, [metadata?.computedAt]);

  const headerRight = (
    <div className="flex flex-col items-end text-sm text-default-500">
      <span>Last updated: {lastUpdatedLabel}</span>
      {isRefreshing && <span className="text-primary-500">Refreshing…</span>}
    </div>
  );

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <div className="flex flex-wrap items-center gap-3">
            <GlobalDateRangePicker
              value={customersCalendarRange}
              preset={customersPreset}
              onAnalyticsChange={handleAnalyticsRangeChange}
            />
            <FilterBar
              filters={filters}
              values={filterValues}
              onFilterChange={handleFilterChange}
            />
          </div>
        }
        rightActions={headerRight}
      />

      <CustomerTable
        customers={customers?.data || []}
        loading={isLoading || isRefreshing}
        pagination={
          customers?.pagination
            ? {
                ...customers.pagination,
                setPage: setCurrentPage,
              }
            : undefined
        }
        statusFilter={statusFilter}
      />
    </div>
  );
});

CustomersView.displayName = "CustomersView";
