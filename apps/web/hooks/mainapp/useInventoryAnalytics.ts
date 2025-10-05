import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useAction } from "convex/react";
import type { Product } from "@/components/dashboard/(analytics)/inventory/components/ProductsTable";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";
import { useShopifyTime } from "./useShopifyTime";

// Local type definitions aligned with Convex returns
export type StockMovementData = {
  period: string;
  inbound: number;
  outbound: number;
  netMovement: number;
  velocity: number;
};

export type StockAlert = {
  id: string;
  type: "critical" | "low" | "reorder" | "overstock";
  productName: string;
  sku: string;
  currentStock: number;
  reorderPoint?: number;
  daysUntilStockout?: number;
  message: string;
};

export type TopPerformersData = {
  best: Array<{
    id: string;
    name: string;
    sku: string;
    image?: string;
    metric: number;
    change: number;
    units: number;
    revenue: number;
    trend: "up" | "down" | "stable";
  }>;
  worst: Array<{
    id: string;
    name: string;
    sku: string;
    image?: string;
    metric: number;
    change: number;
    units: number;
    revenue: number;
    trend: "up" | "down" | "stable";
  }>;
  trending: Array<{
    id: string;
    name: string;
    sku: string;
    image?: string;
    metric: number;
    change: number;
    units: number;
    revenue: number;
    trend: "up" | "down" | "stable";
  }>;
};

export interface UseInventoryAnalyticsParams {
  dateRange?: { startDate: string; endDate: string };
  stockLevel?: string;
  category?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}

export interface UseInventoryAnalyticsReturn {
  overview: {
    totalValue: number;
    totalCOGS: number;
    totalSKUs: number;
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    stockCoverageDays: number;
    deadStock: number;
    totalSales: number;
    unitsSold: number;
    averageSalePrice: number;
    averageProfit: number;
    stockTurnoverRate: number;
    changes: {
      totalValue: number;
      totalCOGS: number;
      totalSKUs: number;
      stockCoverage: number;
      totalSales: number;
      unitsSold: number;
      stockTurnoverRate: number;
    };
  } | null;
  products: {
    data: Product[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  } | null;
  stockAlerts: StockAlert[] | null;
  topPerformers: TopPerformersData | null;
  stockMovement: StockMovementData[] | null;
  isLoading: boolean;
  exportData: () => Promise<Record<string, unknown>[]>;
}

export function useInventoryAnalytics(
  params: UseInventoryAnalyticsParams = {}
): UseInventoryAnalyticsReturn {
  const {
    dateRange,
    stockLevel,
    category,
    searchTerm,
    page = 1,
    pageSize = 50,
  } = params;

  const { timezone } = useOrganizationTimeZone();
  const { offsetMinutes } = useShopifyTime();

  const normalizedDateRange = useMemo(() => {
    if (!dateRange) return undefined;
    const utcRange = dateRangeToUtcWithShopPreference(
      dateRange,
      typeof offsetMinutes === "number" ? offsetMinutes : undefined,
      timezone,
    );
    return {
      ...utcRange,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    } as const;
  }, [dateRange?.endDate, dateRange?.startDate, offsetMinutes, timezone]);

  // Use consolidated action for overview, alerts, topPerformers, and stockMovement
  const [metricsData, setMetricsData] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const fetchMetrics = useAction(api.web.inventory.getInventoryMetrics);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingMetrics(true);

    fetchMetrics({
      dateRange: normalizedDateRange,
    })
      .then((result) => {
        if (!cancelled) {
          setMetricsData(result);
          setIsLoadingMetrics(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load inventory metrics:", error);
        if (!cancelled) {
          setIsLoadingMetrics(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchMetrics, normalizedDateRange?.startDate, normalizedDateRange?.endDate]);

  const overview = metricsData?.overview;
  const stockAlerts = metricsData?.stockAlerts;
  const topPerformers = metricsData?.topPerformers;
  const stockMovement = metricsData?.stockMovement;

  // Fetch products list separately (paginated)
  const productsArgs = useMemo(
    () => ({
      page,
      pageSize,
      stockLevel: stockLevel === "all" ? undefined : stockLevel,
      category: category === "all" ? undefined : category,
      searchTerm,
      dateRange: normalizedDateRange,
    }),
    [
      category,
      normalizedDateRange,
      page,
      pageSize,
      searchTerm,
      stockLevel,
    ],
  );

  const products = useQuery(api.web.inventory.getProductsList, productsArgs);

  // Only treat `undefined` as loading; `null` means "no data" (not loading).
  const isLoading = isLoadingMetrics || products === undefined;

  const exportData = async () => {
    if (!products) return [];

    const csvData = products.data.map((product) => ({
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

    // Convert to CSV format
    if (csvData.length === 0) return [];
    const headers = Object.keys(csvData[0]!);
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers.map((header) => row[header as keyof typeof row]).join(",")
      ),
    ].join("\n");

    // Download CSV
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

  // Transform overview to match new interface
  const transformedOverview = overview
    ? {
        ...overview,
        totalSales: overview.totalSales || 0,
        unitsSold: overview.unitsSold || 0,
        averageSalePrice: overview.averageSalePrice || 0,
        averageProfit: overview.averageProfit || 0,
        stockTurnoverRate: overview.avgTurnoverRate || 0,
        changes: {
          ...overview.changes,
          totalSales: overview.changes?.totalSales || 0,
          unitsSold: overview.changes?.unitsSold || 0,
          stockTurnoverRate: overview.changes?.turnoverRate || 0,
        },
      }
    : null;

  return {
    overview: transformedOverview,
    products: products ?? null,
    stockAlerts: stockAlerts ?? null,
    topPerformers: topPerformers ?? null,
    stockMovement: stockMovement ?? null,
    isLoading,
    exportData,
  };
}
