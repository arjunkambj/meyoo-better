"use client";

import { Skeleton, Spacer } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { memo, useCallback, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useOrdersAnalytics } from "@/hooks";
import { OrdersOverviewCards } from "./components/OrdersOverviewCards";
import { OrdersTable } from "./components/OrdersTable";

// Helper to convert CalendarDate to string
const _calendarDateToString = (date: CalendarDate): string => {
  const year = date.year;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const OrdersView = memo(function OrdersView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { overview, orders, isInitialLoading, loadingStates, exportData } =
    useOrdersAnalytics({
      dateRange,
      status: selectedStatus,
      searchTerm,
      page: currentPage,
    });

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    if (key === "status") {
      setSelectedStatus(value === "all" ? undefined : (value as string));
    } else if (key === "search") {
      setSearchTerm(value as string);
    }
  }, []);

  const handleAnalyticsRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange({ startDate: range.start, endDate: range.end });
    },
    [],
  );

  const filters = [
    {
      key: "status",
      label: "Fulfillment Status",
      type: "select" as const,
      options: [
        { value: "all", label: "All Orders" },
        { value: "unfulfilled", label: "Unfulfilled" },
        { value: "partial", label: "Partially Fulfilled" },
        { value: "fulfilled", label: "Fulfilled" },
        { value: "cancelled", label: "Cancelled" },
        { value: "refunded", label: "Refunded" },
      ],
    },
    {
      key: "search",
      label: "Search",
      type: "search" as const,
      placeholder: "Search by order ID, customer name, or email...",
    },
  ];

  const filterValues = {
    status: selectedStatus || "all",
    search: searchTerm,
  };

  // Remove the early return loading state - we'll handle loading inline

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <Spacer y={0.5} />
      <AnalyticsHeader
        leftActions={
          <div className="flex items-center gap-2">
            <GlobalDateRangePicker
              size="md"
              onAnalyticsChange={handleAnalyticsRangeChange}
            />
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
            disabled={isInitialLoading}
            filename="orders-report"
            formats={["csv", "excel", "pdf"]}
          />
        }
      />

      {/* Overview Cards */}
      {loadingStates.overview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <OrdersOverviewCards metrics={overview} />
      )}

      {/* Orders Table with Pagination */}
      <OrdersTable
        loading={loadingStates.orders}
        orders={orders?.data || []}
        pagination={
          orders?.pagination
            ? {
                page: orders.pagination.page,
                setPage: setCurrentPage,
                total: orders.pagination.total,
              }
            : undefined
        }
      />
    </div>
  );
});
