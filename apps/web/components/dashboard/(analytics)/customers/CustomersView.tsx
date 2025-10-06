"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import { useAnalyticsDateRange, useCustomerAnalytics } from "@/hooks";

import { CustomerTable } from "../customer-insights/components/CustomerTable";

const CustomerKPICards = lazy(() =>
  import("./CustomerKPICards").then((mod) => ({
    default: mod.CustomerKPICards,
  }))
);

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
  } = useAnalyticsDateRange('dashboard-customers', { defaultPreset: 'today' });
  const [statusFilter, setStatusFilter] = useState<"all" | "converted" | "abandoned_cart">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { overview, customers, loadingStates, exportData } = useCustomerAnalytics({
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

  const exportButtonData = useMemo(() => {
    if (Array.isArray(exportData)) {
      return (exportData as Record<string, unknown>[]).map((row) => ({ ...row }));
    }
    if (typeof exportData === "function") return exportData;
    return [] as Record<string, unknown>[];
  }, [exportData]);

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
        rightActions={
          <ExportButton
            color="primary"
            data={exportButtonData}
            disabled={loadingStates.customers}
            filename="customers-database"
            formats={["csv", "pdf"]}
          />
        }
      />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        }
      >
        <CustomerKPICards
          loading={loadingStates.overview}
          metrics={
            overview
              ? {
                totalCustomers: overview.totalCustomers,
                periodCustomerCount: overview.periodCustomerCount,
                prepaidRate: overview.prepaidRate,
                repeatRate: overview.repeatPurchaseRate,
                abandonedCartCustomers: overview.abandonedCartCustomers,
                abandonedRate: overview.abandonedRate,
              }
              : undefined
          }
        />
      </Suspense>

      <CustomerTable
        customers={customers?.data || []}
        loading={loadingStates.customers}
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
