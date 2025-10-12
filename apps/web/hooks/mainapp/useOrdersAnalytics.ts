import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import type {
  AnalyticsOrder,
  OrdersFulfillmentMetrics,
  OrdersOverviewMetrics,
} from "@repo/types";

interface UseOrdersAnalyticsParams {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  status?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface OrdersResult {
  data: AnalyticsOrder[];
  pagination: {
    page: number;
    total: number;
    pageSize: number;
    totalPages: number;
    estimatedTotal?: number;
    hasMore?: boolean;
  };
}

interface OrdersAnalyticsQueryResult {
  overview: OrdersOverviewMetrics | null;
  fulfillment: OrdersFulfillmentMetrics;
  orders: {
    data: AnalyticsOrder[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      estimatedTotal: number;
      hasMore: boolean;
    };
  };
}

export function useOrdersAnalytics(params: UseOrdersAnalyticsParams = {}) {
  const {
    offsetMinutes,
    timezoneIana,
    isLoading: isShopTimeLoading,
  } = useShopifyTime();

  const {
    dateRange,
    status,
    searchTerm,
    page = 1,
    pageSize = 50,
    sortBy,
    sortOrder = "desc",
  } = params;

  const requestedPage = Math.max(1, page);

  const normalizedSearch = useMemo(() => {
    if (!searchTerm) return undefined;
    const trimmed = searchTerm.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [searchTerm]);

  const effectiveRange = useMemo(() => {
    if (dateRange) return dateRange;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [dateRange]);

  const rangeStrings = useMemo(() => {
    if (!effectiveRange || isShopTimeLoading) return null;
    return dateRangeToUtcWithShopPreference(
      effectiveRange,
      typeof offsetMinutes === "number" ? offsetMinutes : undefined,
      timezoneIana,
    );
  }, [effectiveRange, isShopTimeLoading, offsetMinutes, timezoneIana]);

  const normalizedRange = useMemo(() => {
    if (!rangeStrings) return null;

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
    if (isShopTimeLoading || !normalizedRange) return "skip" as const;
    return {
      dateRange: normalizedRange,
      status,
      searchTerm: normalizedSearch,
      sortBy,
      sortOrder,
      page: requestedPage,
      pageSize,
    } as const;
  }, [
    isShopTimeLoading,
    normalizedRange,
    status,
    normalizedSearch,
    sortBy,
    sortOrder,
    requestedPage,
    pageSize,
  ]);

  const analyticsResult = useQuery(
    api.web.orders.getOrdersAnalytics,
    queryArgs,
  ) as OrdersAnalyticsQueryResult | undefined;

  const baseLoading = queryArgs === "skip" || analyticsResult === undefined;

  const overview = analyticsResult?.overview ?? undefined;
  const orders: OrdersResult | undefined = analyticsResult
    ? {
        data: analyticsResult.orders.data,
        pagination: {
          page: analyticsResult.orders.pagination.page,
          total: analyticsResult.orders.pagination.total,
          pageSize: analyticsResult.orders.pagination.pageSize,
          totalPages: analyticsResult.orders.pagination.totalPages,
          estimatedTotal: analyticsResult.orders.pagination.estimatedTotal,
          hasMore: analyticsResult.orders.pagination.hasMore,
        },
      }
    : undefined;

  const fulfillmentMetrics: OrdersFulfillmentMetrics | undefined =
    analyticsResult?.fulfillment ?? undefined;

  const loadingStates = {
    overview: baseLoading,
    orders: baseLoading,
    fulfillment: baseLoading,
  };

  const isInitialLoading = baseLoading && requestedPage === 1;

  return {
    overview,
    orders,
    fulfillmentMetrics,
    isLoading: baseLoading,
    isInitialLoading,
    loadingStates,
    orderOverview: overview,
  };
}
