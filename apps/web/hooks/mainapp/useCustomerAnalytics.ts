import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { formatCurrency } from "@/libs/utils/format";
import { useShopifyTime } from "./useShopifyTime";
import { useUser } from "./useUser";

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

interface CustomersQueryResult {
  rows: Customer[];
  pagination: CustomersPagination;
}

const DEFAULT_PAGE_SIZE = 50;

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

const defaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

export function useCustomerAnalytics(params: UseCustomerAnalyticsParams = {}) {
  const { primaryCurrency } = useUser();
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

  const customersLoading = queryArgs !== "skip" && result === undefined;

  const customers = useMemo(() => {
    if (!result) return undefined;

    return {
      data: result.rows,
      pagination: result.pagination,
    };
  }, [result]);

  const exportData = useMemo(() => {
    if (!customers) return [] as Array<Record<string, unknown>>;

    return customers.data.map((c) => ({
      Name: c.name,
      Email: c.email,
      Status: c.status,
      "Lifetime Value": formatCurrency(c.lifetimeValue, primaryCurrency),
      "Lifetime Orders": c.orders,
      "Orders (Range)": c.periodOrders,
      "Avg Order Value": formatCurrency(c.avgOrderValue, primaryCurrency),
      "Revenue (Range)": formatCurrency(c.periodRevenue, primaryCurrency),
      "Last Order": c.lastOrderDate,
      "First Order": c.firstOrderDate,
      Segment: c.segment,
      Returning: c.isReturning ? "Yes" : "No",
      Location: c.city && c.country ? `${c.city}, ${c.country}` : "Unknown",
    }));
  }, [customers, primaryCurrency]);

  const loadingStates = {
    customers: customersLoading,
  };

  return {
    customers,
    exportData,
    isLoading: customersLoading,
    isInitialLoading: customersLoading && page === 1,
    loadingStates,
  };
}
