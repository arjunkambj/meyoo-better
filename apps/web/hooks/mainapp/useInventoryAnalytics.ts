import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { Product } from "@/components/dashboard/(analytics)/inventory/components/ProductsTable";

import { api } from "@/libs/convexApi";

export interface UseInventoryAnalyticsParams {
  stockLevel?: string;
  category?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryOverview {
  totalValue: number;
  totalCOGS: number;
  totalSKUs: number;
  stockCoverageDays: number;
  deadStock: number;
}

export interface UseInventoryAnalyticsReturn {
  overview: InventoryOverview | null;
  products: {
    data: Product[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    hasMore: boolean;
  } | null;
  isLoading: boolean;
  exportData: () => Promise<Record<string, unknown>[]>;
}

export function useInventoryAnalytics(
  params: UseInventoryAnalyticsParams = {},
): UseInventoryAnalyticsReturn {
  const { stockLevel, category, searchTerm, page = 1, pageSize = 50 } = params;

  const analyticsArgs = useMemo(
    () => ({
      page,
      pageSize,
      stockLevel: stockLevel === "all" ? undefined : stockLevel,
      category: category === "all" ? undefined : category,
      searchTerm,
    }),
    [page, pageSize, stockLevel, category, searchTerm],
  );

  const analytics = useQuery(
    api.web.inventory.getInventoryAnalytics,
    analyticsArgs,
  );

  const isLoading = analytics === undefined;

  const exportData = async () => {
    if (!analytics) return [];

    const csvData = analytics.products.data.map((product) => ({
      Name: product.name,
      SKU: product.sku,
      Category: product.category,
      Vendor: product.vendor,
      Stock: product.stock,
      Available: product.available,
      Reserved: product.reserved,
      "Reorder Point": product.reorderPoint,
      Status: product.stockStatus,
      Price: product.price,
      Cost: product.cost,
      Margin: product.margin,
      "Units Sold": product.unitsSold || 0,
      "Turnover Rate": product.turnoverRate,
      "Last Sold": product.lastSold || "N/A",
    }));

    if (csvData.length === 0) return [];
    const headers = Object.keys(csvData[0]!);
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers.map((header) => row[header as keyof typeof row]).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    return csvData;
  };

  const transformedOverview: InventoryOverview | null = analytics
    ? {
        totalValue: analytics.overview.totalValue,
        totalCOGS: analytics.overview.totalCOGS,
        totalSKUs: analytics.overview.totalSKUs,
        stockCoverageDays: analytics.overview.stockCoverageDays,
        deadStock: analytics.overview.deadStock,
      }
    : null;

  return {
    overview: transformedOverview,
    products: analytics ? analytics.products : null,
    isLoading,
    exportData,
  };
}
