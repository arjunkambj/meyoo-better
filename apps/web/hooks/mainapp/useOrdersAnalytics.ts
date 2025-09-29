import { useAction } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/libs/convexApi";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";
import type {
  OrdersAnalyticsResult,
  OrdersOverviewMetrics,
  OrdersFulfillmentMetrics,
  AnalyticsOrder,
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
  };
}

export function useOrdersAnalytics(params: UseOrdersAnalyticsParams = {}) {
  const { timezone } = useOrganizationTimeZone();

  const {
    dateRange,
    status,
    searchTerm,
    page = 1,
    pageSize = 50,
    sortBy,
    sortOrder = "desc",
  } = params;

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

  const args = useMemo(() => {
    if (!effectiveRange) return "skip" as const;
    const rangeStrings = toUtcRangeStrings(effectiveRange, timezone);

    return {
      dateRange: rangeStrings,
      status,
      searchTerm,
      page,
      pageSize,
      sortBy,
      sortOrder,
    };
  }, [effectiveRange, timezone, status, searchTerm, page, pageSize, sortBy, sortOrder]);

  const getAnalytics = useAction(api.web.orders.getAnalytics);

  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getAnalytics>> | null | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (args === "skip") {
      setAnalytics(undefined);
      return;
    }

    let cancelled = false;
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;
    setAnalytics(undefined);

    getAnalytics(args)
      .then((response) => {
        if (cancelled || requestIdRef.current !== currentRequestId) return;
        setAnalytics(response ?? null);
      })
      .catch((error) => {
        if (cancelled || requestIdRef.current !== currentRequestId) return;
        console.error("Failed to load orders analytics", error);
        setAnalytics(null);
      });

    return () => {
      cancelled = true;
    };
  }, [args, getAnalytics]);

  const result = analytics?.result as OrdersAnalyticsResult | undefined;

  const overview: OrdersOverviewMetrics | undefined = useMemo(() => {
    if (!result?.overview) return undefined;
    return result.overview;
  }, [result?.overview]);

  const orders: OrdersResult | undefined = useMemo(() => {
    if (!result?.orders) return undefined;
    return {
      data: result.orders.data,
      pagination: result.orders.pagination,
    };
  }, [result?.orders]);

  const fulfillmentMetrics: OrdersFulfillmentMetrics | undefined = useMemo(() => {
    if (!result?.fulfillment) return undefined;
    return result.fulfillment;
  }, [result?.fulfillment]);

  const exportData = result?.exportRows ?? [];

  const loadingStates = {
    overview: analytics === undefined,
    orders: analytics === undefined,
    fulfillment: analytics === undefined,
  };

  const isLoading = Object.values(loadingStates).some(Boolean);
  const isInitialLoading = analytics === undefined;

  return {
    overview,
    orders,
    fulfillmentMetrics,
    exportData,
    isLoading,
    isInitialLoading,
    loadingStates,
    orderOverview: overview,
  };
}
