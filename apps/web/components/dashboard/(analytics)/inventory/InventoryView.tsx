"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import { useInventoryAnalytics } from "@/hooks";

import { InventoryOverviewCards } from "./components/InventoryOverviewCards";
import { ProductsTable } from "./components/ProductsTable";

export function InventoryView() {
  const [dateRange, setDateRange] = useState<
    { startDate: string; endDate: string } | undefined
  >();
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { overview, products, isLoading, exportData } = useInventoryAnalytics({
    dateRange,
    stockLevel: stockFilter,
    category: categoryFilter,
    searchTerm: searchTerm ? searchTerm : undefined,
    page: currentPage,
  });

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    if (key === "stock") {
      setStockFilter((value as string) || "all");
    } else if (key === "category") {
      setCategoryFilter((value as string) || "all");
    }
  }, []);

  const handleSearchSubmit = useCallback((term: string) => {
    const normalized = term.trim();
    setSearchTerm(normalized);
    setCurrentPage(1);
  }, []);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (products?.data || []).map((p) => p.category || "Uncategorized")
        )
      )
        .sort()
        .map((c) => ({ value: c, label: c })),
    [products?.data]
  );

  const filters = [
    {
      key: "stock",
      label: "Stock Level",
      type: "select" as const,
      options: [
        { value: "all", label: "All Stock" },
        { value: "healthy", label: "Healthy Stock" },
        { value: "low", label: "Low Stock" },
        { value: "critical", label: "Critical Stock" },
        { value: "out", label: "Out of Stock" },
      ],
    },
    {
      key: "category",
      label: "Category",
      type: "select" as const,
      options: [{ value: "all", label: "All Categories" }, ...categoryOptions],
    },
  ];

  const filterValues = {
    stock: stockFilter,
    category: categoryFilter,
  };

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
        <Spacer y={0.5} />
        {/* Header - Always visible without loading state */}
        <AnalyticsHeader
          leftActions={
            <div className="flex items-center gap-2">
              <GlobalDateRangePicker
                onAnalyticsChange={(range) => {
                  setDateRange({ startDate: range.start, endDate: range.end });
                }}
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
              filename="inventory-report"
              formats={["csv", "excel", "pdf"]}
            />
          }
        />

        {/* Overview Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`card-skeleton-${i}`} className="h-32 rounded-lg" />
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-default-50 rounded-2xl border border-divider p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-48 rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-28 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-10 w-80 rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              {[...Array(8)].map((_, i) => (
                <Skeleton
                  key={`inventory-table-skeleton-${i + 1}`}
                  className="h-16 w-full rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Performance Metrics Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-lg" />
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <Spacer y={0.5} />

      <AnalyticsHeader
        leftActions={
          <div className="flex items-center gap-2">
            <GlobalDateRangePicker
              onAnalyticsChange={(range) => {
                setDateRange({ startDate: range.start, endDate: range.end });
              }}
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
            filename="inventory-report"
            formats={["csv", "excel", "pdf"]}
          />
        }
      />

      {/* Overview Cards */}
      <InventoryOverviewCards metrics={overview} />

      {/* Products Table */}
      <ProductsTable
        loading={products === undefined}
        pagination={
          products?.pagination
            ? {
                page: products.pagination.page,
                setPage: setCurrentPage,
                total: products.pagination.total,
              }
            : undefined
        }
        products={products?.data || []}
        searchValue={searchTerm}
        onSearchSubmit={handleSearchSubmit}
      />
    </div>
  );
}
