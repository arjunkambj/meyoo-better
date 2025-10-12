import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  isRefreshing: boolean;
  metadata: {
    computedAt?: number;
    analysisWindowDays?: number;
    isStale: boolean;
  } | null;
  refresh: (options?: { force?: boolean }) => Promise<void>;
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

  const refreshInventory = useAction(
    api.web.inventory.refreshInventoryAnalytics,
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshPendingRef = useRef(false);

  const triggerRefresh = useCallback(
    async (force = false) => {
      if (refreshPendingRef.current) return;
      refreshPendingRef.current = true;
      setIsRefreshing(true);
      try {
        await refreshInventory({ force });
      } catch (error) {
        console.error("Failed to refresh inventory analytics", error);
      } finally {
        refreshPendingRef.current = false;
        setIsRefreshing(false);
      }
    },
    [refreshInventory],
  );

  useEffect(() => {
    if (!analytics) return;
    if (!analytics.metadata.isStale) return;
    triggerRefresh(false);
  }, [analytics?.metadata.isStale, triggerRefresh]);

  const isLoading = analytics === undefined;

  const transformedOverview: InventoryOverview | null = analytics
    ? {
        totalValue: analytics.overview.totalValue,
        totalCOGS: analytics.overview.totalCOGS,
        totalSKUs: analytics.overview.totalSKUs,
        stockCoverageDays: analytics.overview.stockCoverageDays,
        deadStock: analytics.overview.deadStock,
      }
    : null;

  const metadata = analytics
    ? {
        computedAt: analytics.metadata.computedAt,
        analysisWindowDays: analytics.metadata.analysisWindowDays,
        isStale: analytics.metadata.isStale,
      }
    : null;

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      await triggerRefresh(options?.force ?? true);
    },
    [triggerRefresh],
  );

  return {
    overview: transformedOverview,
    products: analytics ? analytics.products : null,
    isLoading,
    isRefreshing,
    metadata,
    refresh,
  };
}
