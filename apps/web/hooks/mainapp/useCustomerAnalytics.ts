import { useAction } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";

interface Customer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: string;
  lifetimeValue: number;
  orders: number;
  avgOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
  shopifyCreatedAt: string;
  shopifyUpdatedAt?: string;
  segment: string;
  city?: string;
  country?: string;
  periodOrders: number;
  periodRevenue: number;
  isReturning: boolean;
}

interface CustomersPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface CustomersMetadata {
  computedAt?: number;
  analysisWindowDays?: number;
  windowStartMs?: number;
  windowEndMsExclusive?: number;
  isStale: boolean;
}

interface CustomersQueryResult {
  rows: Customer[];
  pagination: CustomersPagination;
  metadata: CustomersMetadata;
}

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_ANALYSIS_DAYS = 30;
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const CUSTOMER_SNAPSHOT_MAX_DAYS = 365;

export interface UseCustomerAnalyticsParams {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  status?: "all" | "converted" | "abandoned_cart";
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  segment?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface UseCustomerAnalyticsReturn {
  customers:
    | {
        data: Customer[];
        pagination: CustomersPagination;
      }
    | undefined;
  metadata: CustomersMetadata | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadingStates: {
    customers: boolean;
  };
  refresh: (options?: { force?: boolean }) => Promise<void>;
}

const defaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const computeRequestedDays = (range: {
  startDate: string;
  endDate: string;
  dayCount?: number;
}): number => {
  if (typeof range.dayCount === "number" && Number.isFinite(range.dayCount)) {
    return Math.max(1, Math.min(Math.floor(range.dayCount), CUSTOMER_SNAPSHOT_MAX_DAYS));
  }

  const start = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${range.endDate}T23:59:59.999Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return DEFAULT_ANALYSIS_DAYS;
  }

  return Math.max(
    1,
    Math.min(Math.round((end - start) / MS_IN_DAY), CUSTOMER_SNAPSHOT_MAX_DAYS),
  );
};

export function useCustomerAnalytics(
  params: UseCustomerAnalyticsParams = {},
): UseCustomerAnalyticsReturn {
  const { offsetMinutes, timezoneIana } = useShopifyTime();

  const {
    dateRange,
    status = "all",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    searchTerm,
    segment,
    sortBy,
    sortOrder = "desc",
  } = params;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshPendingRef = useRef(false);
  const refreshAnalytics = useAction(
    api.web.customers.refreshCustomerAnalytics,
  );

  const normalizedSearch = useMemo(() => {
    if (!searchTerm) return undefined;
    const trimmed = searchTerm.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [searchTerm]);

  const normalizedSegment = useMemo(() => {
    if (!segment) return undefined;
    const trimmed = segment.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [segment]);

  const effectiveDateRange = useMemo(() => {
    if (dateRange) return dateRange;
    return defaultRange();
  }, [dateRange?.startDate, dateRange?.endDate]);

  const rangeStrings = useMemo(() => {
    if (!effectiveDateRange) return null;
    return dateRangeToUtcWithShopPreference(
      effectiveDateRange,
      typeof offsetMinutes === "number" ? offsetMinutes : undefined,
      timezoneIana,
    );
  }, [effectiveDateRange, offsetMinutes, timezoneIana]);

  const normalizedRange = useMemo(() => {
    if (!rangeStrings) return null;

    return {
      startDate: effectiveDateRange.startDate,
      endDate: effectiveDateRange.endDate,
      startDateTimeUtc:
        rangeStrings.startDateTimeUtc ?? `${effectiveDateRange.startDate}T00:00:00.000Z`,
      endDateTimeUtc:
        rangeStrings.endDateTimeUtc ?? `${effectiveDateRange.endDate}T23:59:59.999Z`,
      endDateTimeUtcExclusive:
        rangeStrings.endDateTimeUtcExclusive ?? `${effectiveDateRange.endDate}T23:59:59.999Z`,
      dayCount: rangeStrings.dayCount ?? 0,
    } as const;
  }, [effectiveDateRange.endDate, effectiveDateRange.startDate, rangeStrings]);

  const requestedDays = useMemo(() => {
    if (!normalizedRange) {
      return DEFAULT_ANALYSIS_DAYS;
    }
    return Math.max(1, computeRequestedDays(normalizedRange));
  }, [normalizedRange]);

  const queryArgs = useMemo(() => {
    if (!normalizedRange) return "skip" as const;
    return {
      dateRange: normalizedRange,
      status: status === "all" ? undefined : status,
      searchTerm: normalizedSearch,
      segment: normalizedSegment,
      sortBy,
      sortOrder,
      page,
      pageSize,
    };
  }, [
    normalizedRange,
    status,
    normalizedSearch,
    normalizedSegment,
    sortBy,
    sortOrder,
    page,
    pageSize,
  ]);

  const result = useQuery(
    (api.web.customers as Record<string, any>).getCustomersPage,
    queryArgs,
  ) as CustomersQueryResult | undefined;

  const metadata = result?.metadata ?? null;
  const customersLoading = queryArgs !== "skip" && result === undefined;

  const triggerRefresh = useCallback(
    async (force = false) => {
      if (refreshPendingRef.current) return;
      if (!normalizedRange) return;

      refreshPendingRef.current = true;
      setIsRefreshing(true);
      try {
        await refreshAnalytics({
          force,
          analysisWindowDays: requestedDays,
          dateRange: normalizedRange,
        });
      } catch (error) {
        console.error("Failed to refresh customer analytics", error);
      } finally {
        refreshPendingRef.current = false;
        setIsRefreshing(false);
      }
    },
    [normalizedRange, refreshAnalytics, requestedDays],
  );

  useEffect(() => {
    if (!normalizedRange) return;
    if (!metadata) return;
    if (!metadata.isStale) return;
    triggerRefresh(false);
  }, [
    metadata?.isStale,
    metadata?.analysisWindowDays,
    metadata?.windowStartMs,
    metadata?.windowEndMsExclusive,
    normalizedRange,
    triggerRefresh,
  ]);

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      await triggerRefresh(options?.force ?? true);
    },
    [triggerRefresh],
  );

  const customers = useMemo(() => {
    if (!result) return undefined;

    return {
      data: result.rows,
      pagination: result.pagination,
    };
  }, [result]);

  const loadingStates = {
    customers: customersLoading,
  };

  return {
    customers,
    metadata,
    isLoading: customersLoading,
    isInitialLoading: customersLoading && page === 1,
    isRefreshing,
    loadingStates,
    refresh,
  };
}
