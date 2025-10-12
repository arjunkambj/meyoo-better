"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { memo, useCallback, useEffect, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useAnalyticsDateRange, useOrdersAnalytics } from "@/hooks";
import { OrdersTable } from "./components/OrdersTable";
import { OrdersOverviewCards } from "./components/OrdersOverviewCards";

export const OrdersView = memo(function OrdersView() {
  const {
    analyticsRange: ordersRange,
    calendarRange: ordersCalendarRange,
    preset: ordersPreset,
    updateRange: updateOrdersRange,
  } = useAnalyticsDateRange('dashboard-orders', { defaultPreset: 'today', sharedKey: null });
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  const { overview, orders, loadingStates } =
    useOrdersAnalytics({
      dateRange: ordersRange,
      status: selectedStatus,
      page: currentPage,
    });

  useEffect(() => {
    const resolvedPage = orders?.pagination?.page;
    if (typeof resolvedPage === "number" && resolvedPage !== currentPage) {
      setCurrentPage(resolvedPage);
    }
  }, [orders?.pagination?.page, currentPage, setCurrentPage]);

  const handleFilterChange = useCallback(
    (key: string, value: unknown) => {
      if (key === "status") {
        setSelectedStatus(value === "all" ? undefined : (value as string));
        setCurrentPage(1);
      }
    },
    [setSelectedStatus, setCurrentPage],
  );

  const handleAnalyticsRangeChange = useCallback(
    (...args: Parameters<typeof updateOrdersRange>) => {
      setCurrentPage(1);
      return updateOrdersRange(...args);
    },
    [setCurrentPage, updateOrdersRange],
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
  ];

  const filterValues = {
    status: selectedStatus || "all",
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
              value={ordersCalendarRange}
              preset={ordersPreset}
              onAnalyticsChange={handleAnalyticsRangeChange}
            />
            <FilterBar
              filters={filters}
              values={filterValues}
              onFilterChange={handleFilterChange}
            />
          </div>
        }
        rightActions={null}
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
                estimatedTotal: orders.pagination.estimatedTotal,
                pageSize: orders.pagination.pageSize,
              }
            : undefined
        }
      />
    </div>
  );
});
