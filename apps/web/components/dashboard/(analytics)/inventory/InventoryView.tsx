"use client";

import { Skeleton, Spacer } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import { useInventoryAnalytics } from "@/hooks";

import { InventoryOverviewCards } from "./components/InventoryOverviewCards";
import { ProductsTable } from "./components/ProductsTable";

export function InventoryView() {
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { overview, products, isLoading, exportData } = useInventoryAnalytics({
    stockLevel: stockFilter,
    category: categoryFilter,
    page: currentPage,
  });

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    if (key === "stock") {
      setStockFilter((value as string) || "all");
    } else if (key === "category") {
      setCategoryFilter((value as string) || "all");
    }
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

  const headerLeft = (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold leading-tight">Inventory Products</h1>
      <div className="flex flex-wrap items-center gap-2">
        <FilterBar
          filters={filters}
          values={filterValues}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );

  const exportButtonData = useMemo(() => {
    if (Array.isArray(exportData)) {
      return (exportData as Record<string, unknown>[]).map((row) => ({ ...row }));
    }
    if (typeof exportData === "function") return exportData;
    return [] as Record<string, unknown>[];
  }, [exportData]);

  const headerRight = (
    <ExportButton
      color="primary"
      data={exportButtonData}
      filename="inventory-report"
      formats={["csv", "pdf"]}
    />
  );

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
        <Spacer y={0.5} />
        {/* Header - Always visible without loading state */}
        <AnalyticsHeader leftActions={headerLeft} rightActions={headerRight} />

        {/* Overview Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`card-skeleton-${i}`} className="h-32 rounded-lg" />
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="rounded-2xl border border-divider bg-content2 p-6">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton
                key={`inventory-table-skeleton-${i + 1}`}
                className="h-16 w-full rounded-lg"
              />
            ))}
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
        leftActions={headerLeft}
        rightActions={headerRight}
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
      />
    </div>
  );
}
