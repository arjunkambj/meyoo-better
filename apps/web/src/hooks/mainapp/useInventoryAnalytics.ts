import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { AnalyticsDateRange } from "@repo/types";
import type { Product } from "@/components/dashboard/(analytics)/inventory/components/ProductsTable";

import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { api } from "@/libs/convexApi";
import { useShopifyTime } from "./useShopifyTime";

export interface UseInventoryAnalyticsParams {
  stockLevel?: string;
  category?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
  dateRange?: AnalyticsDateRange;
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
  const {
    stockLevel,
    category,
    searchTerm,
    page = 1,
    pageSize = 50,
    dateRange,
  } = params;
  const {
    offsetMinutes,
    timezoneIana,
    isLoading: isShopTimeLoading,
  } = useShopifyTime();

  const effectiveRange = useMemo(() => dateRange ?? null, [dateRange]);

  const rangeStrings = useMemo(() => {
    if (!effectiveRange || isShopTimeLoading) {
      return null;
    }
    return dateRangeToUtcWithShopPreference(
      {
        startDate: effectiveRange.startDate,
        endDate: effectiveRange.endDate,
      },
      typeof offsetMinutes === "number" ? offsetMinutes : undefined,
      timezoneIana,
    );
  }, [effectiveRange, isShopTimeLoading, offsetMinutes, timezoneIana]);

  const normalizedRange = useMemo(() => {
    if (!effectiveRange || !rangeStrings) {
      return undefined;
    }

    return {
      startDate: effectiveRange.startDate,
      endDate: effectiveRange.endDate,
      startDateTimeUtc: rangeStrings.startDateTimeUtc,
      endDateTimeUtc: rangeStrings.endDateTimeUtc,
      endDateTimeUtcExclusive: rangeStrings.endDateTimeUtcExclusive,
      dayCount: rangeStrings.dayCount,
    } as const;
  }, [effectiveRange, rangeStrings]);

  const queryArgs = useMemo(() => {
    if (effectiveRange && isShopTimeLoading) {
      return "skip";
    }

    const baseArgs = {
      page,
      pageSize,
      stockLevel: stockLevel === "all" ? undefined : stockLevel,
      category: category === "all" ? undefined : category,
      searchTerm,
    };

    if (normalizedRange) {
      return {
        ...baseArgs,
        dateRange: normalizedRange,
      };
    }

    return baseArgs;
  }, [
    effectiveRange,
    isShopTimeLoading,
    page,
    pageSize,
    stockLevel,
    category,
    searchTerm,
    normalizedRange,
  ]);

  const analytics = useQuery(
    api.web.inventory.getInventoryAnalytics,
    queryArgs,
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
  }, [analytics, triggerRefresh]);

  const isLoading = queryArgs === "skip" || analytics === undefined;

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
