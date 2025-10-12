import { useQuery } from "convex-helpers/react/cache/hooks";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import { useUser } from "./useUser";
import { formatCurrency } from "@/libs/utils/format";

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
  segment: string;
  city?: string;
  country?: string;
  periodOrders: number;
  periodRevenue: number;
  isReturning: boolean;
}

interface CustomersResult {
  data: Customer[];
  pagination: {
    page: number;
    total: number;
    pageSize: number;
    hasMore: boolean;
  };
}

const END_CURSOR = "__END__";
const DEFAULT_PAGE_SIZE = 50;

interface CustomersPageSnapshot {
  page: Customer[];
  continueCursor: string;
  isDone: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  info?: {
    pageSize: number;
    returned: number;
    hasMore: boolean;
    truncated?: boolean;
  };
}

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

type BackendOverview = {
};

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

  const requestedPage = Math.max(1, page);

  const cursorMapRef = useRef<Record<number, string | null>>({ 1: null });
  const [cursorRevision, setCursorRevision] = useState(0);
  const [prefetchPage, setPrefetchPage] = useState<number | null>(null);
  const prefetchInFlightRef = useRef<number | null>(null);
  const maxKnownPageRef = useRef<number | null>(null);
  const [maxKnownPageVersion, setMaxKnownPageVersion] = useState(0);

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

  const cursorIdentity = useMemo(() => {
    if (!normalizedRange) return null;
    return JSON.stringify({
      range: normalizedRange,
      status,
      segment: normalizedSegment ?? null,
      search: normalizedSearch ?? null,
      sortBy: sortBy ?? null,
      sortOrder,
      pageSize,
    });
  }, [
    normalizedRange?.startDate,
    normalizedRange?.endDate,
    normalizedRange?.startDateTimeUtc,
    normalizedRange?.endDateTimeUtcExclusive,
    status,
    normalizedSegment,
    normalizedSearch,
    sortBy,
    sortOrder,
    pageSize,
  ]);

  useEffect(() => {
    cursorMapRef.current = { 1: null };
    maxKnownPageRef.current = null;
    prefetchInFlightRef.current = null;
    setPrefetchPage(null);
    setCursorRevision((prev) => prev + 1);
    setMaxKnownPageVersion(0);
  }, [cursorIdentity]);

  const effectivePage = useMemo(() => {
    const maxKnown = maxKnownPageRef.current;
    if (maxKnown !== null && requestedPage > maxKnown) {
      return maxKnown;
    }
    return requestedPage;
  }, [requestedPage, maxKnownPageVersion]);

  const waitingForCursor = useMemo(() => {
    if (effectivePage <= 1) return false;
    return !(effectivePage in cursorMapRef.current);
  }, [effectivePage, cursorRevision]);

  const currentCursor = useMemo(() => {
    if (effectivePage === 1) return null;
    return cursorMapRef.current[effectivePage] ?? null;
  }, [effectivePage, cursorRevision]);

  const customersQueryArgs = useMemo(() => {
    if (!normalizedRange || waitingForCursor) return "skip" as const;
    return {
      dateRange: normalizedRange,
      status: status === "all" ? undefined : status,
      searchTerm: normalizedSearch,
      segment: normalizedSegment,
      sortBy,
      sortOrder,
      page: effectivePage,
      pageSize,
      paginationOpts: {
        cursor: currentCursor,
        numItems: pageSize,
      },
    };
  }, [
    normalizedRange?.startDate,
    normalizedRange?.endDate,
    normalizedRange?.startDateTimeUtc,
    normalizedRange?.endDateTimeUtcExclusive,
    normalizedRange?.endDateTimeUtc,
    normalizedRange?.dayCount,
    status,
    normalizedSearch,
    normalizedSegment,
    sortBy,
    sortOrder,
    pageSize,
    waitingForCursor,
    currentCursor,
    effectivePage,
  ]);

  useEffect(() => {
    if (!normalizedRange) {
      return;
    }

    if (prefetchInFlightRef.current !== null) {
      return;
    }

    const targetPage = effectivePage;
    for (let candidate = 2; candidate <= targetPage; candidate++) {
      if (!(candidate in cursorMapRef.current)) {
        const predecessor = candidate - 1;
        if (predecessor < 1) {
          break;
        }
        if (!(predecessor in cursorMapRef.current)) {
          continue;
        }
        prefetchInFlightRef.current = predecessor;
        setPrefetchPage(predecessor);
        return;
      }
    }

    if (prefetchPage !== null) {
      setPrefetchPage(null);
    }
  }, [effectivePage, normalizedRange, cursorRevision, prefetchPage]);

  const prefetchQueryArgs = useMemo(() => {
    if (!normalizedRange || prefetchPage === null) return "skip" as const;
    if (!(prefetchPage in cursorMapRef.current)) return "skip" as const;
    const cursor = cursorMapRef.current[prefetchPage];
    if (prefetchPage > 1 && cursor === null) return "skip" as const;

    return {
      dateRange: normalizedRange,
      status: status === "all" ? undefined : status,
      searchTerm: normalizedSearch,
      segment: normalizedSegment,
      sortBy,
      sortOrder,
      page: prefetchPage,
      pageSize,
      paginationOpts: {
        cursor,
        numItems: pageSize,
      },
    };
  }, [
    normalizedRange?.startDate,
    normalizedRange?.endDate,
    normalizedRange?.startDateTimeUtc,
    normalizedRange?.endDateTimeUtcExclusive,
    normalizedRange?.endDateTimeUtc,
    normalizedRange?.dayCount,
    status,
    normalizedSearch,
    normalizedSegment,
    sortBy,
    sortOrder,
    pageSize,
    prefetchPage,
    cursorRevision,
  ]);

  const prefetchSnapshot = useQuery(
    (api.web.customers as Record<string, any>).getCustomerList,
    prefetchQueryArgs,
  ) as CustomersPageSnapshot | undefined;

  const customersPageSnapshot = useQuery(
    (api.web.customers as Record<string, any>).getCustomerList,
    customersQueryArgs,
  ) as CustomersPageSnapshot | undefined;

  useEffect(() => {
    if (!customersPageSnapshot) return;

    const hasMore = customersPageSnapshot.info?.hasMore ??
      (customersPageSnapshot.continueCursor !== END_CURSOR && !customersPageSnapshot.isDone);

    let cursorMapChanged = false;
    const nextPageIndex = effectivePage + 1;

    if (!(effectivePage in cursorMapRef.current)) {
      cursorMapRef.current[effectivePage] = currentCursor ?? null;
      cursorMapChanged = true;
    }

    if (hasMore && customersPageSnapshot.continueCursor !== END_CURSOR) {
      const nextCursor = customersPageSnapshot.continueCursor;
      if (cursorMapRef.current[nextPageIndex] !== nextCursor) {
        cursorMapRef.current[nextPageIndex] = nextCursor;
        cursorMapChanged = true;
      }
    } else {
      if (nextPageIndex in cursorMapRef.current) {
        delete cursorMapRef.current[nextPageIndex];
        cursorMapChanged = true;
      }

      if (customersPageSnapshot.isDone) {
        const maxPage = effectivePage;
        if (maxKnownPageRef.current === null || maxKnownPageRef.current < maxPage) {
          maxKnownPageRef.current = maxPage;
          setMaxKnownPageVersion((prev) => prev + 1);
        }
      }
    }

    if (cursorMapChanged) {
      setCursorRevision((prev) => prev + 1);
    }

    if (prefetchInFlightRef.current === effectivePage) {
      prefetchInFlightRef.current = null;
    }
  }, [customersPageSnapshot, effectivePage, currentCursor]);

  useEffect(() => {
    const pageBeingPrefetched = prefetchInFlightRef.current;
    if (!prefetchSnapshot || pageBeingPrefetched === null) {
      return;
    }

    const hasMore = prefetchSnapshot.info?.hasMore ??
      (prefetchSnapshot.continueCursor !== END_CURSOR && !prefetchSnapshot.isDone);

    let cursorMapChanged = false;
    const nextPageIndex = pageBeingPrefetched + 1;

    if (hasMore && prefetchSnapshot.continueCursor !== END_CURSOR) {
      const nextCursor = prefetchSnapshot.continueCursor;
      if (cursorMapRef.current[nextPageIndex] !== nextCursor) {
        cursorMapRef.current[nextPageIndex] = nextCursor;
        cursorMapChanged = true;
      }
    } else {
      if (nextPageIndex in cursorMapRef.current) {
        delete cursorMapRef.current[nextPageIndex];
        cursorMapChanged = true;
      }

      if (prefetchSnapshot.isDone) {
        const maxPage = pageBeingPrefetched;
        if (maxKnownPageRef.current === null || maxKnownPageRef.current < maxPage) {
          maxKnownPageRef.current = maxPage;
          setMaxKnownPageVersion((prev) => prev + 1);
        }
      }
    }

    prefetchInFlightRef.current = null;
    setPrefetchPage(null);

    if (cursorMapChanged) {
      setCursorRevision((prev) => prev + 1);
    }
  }, [prefetchSnapshot]);

  const customersLoading =
    (customersQueryArgs !== "skip" && customersPageSnapshot === undefined) ||
    waitingForCursor;

  const customers: CustomersResult | undefined = useMemo(() => {
    if (!customersPageSnapshot) return undefined;

    const paginationSource = customersPageSnapshot.pagination ?? {
      page: effectivePage,
      pageSize,
      total: customersPageSnapshot.page.length,
      totalPages: Math.max(
        1,
        Math.ceil(
          Math.max(customersPageSnapshot.page.length, 1) / Math.max(pageSize, 1),
        ),
      ),
    };

    const hasMore = customersPageSnapshot.info?.hasMore ??
      (customersPageSnapshot.continueCursor !== END_CURSOR && !customersPageSnapshot.isDone);

    return {
      data: customersPageSnapshot.page,
      pagination: {
        page: paginationSource.page,
        total: paginationSource.total,
        pageSize: paginationSource.pageSize,
        hasMore,
      },
    };
  }, [customersPageSnapshot, pageSize, effectivePage]);

  const exportData = useMemo(() => {
    if (!customers) return [] as Array<Record<string, unknown>>;

    return customers.data.map((c) => ({
      Name: c.name,
      Email: c.email,
      Status: c.status,
      "Lifetime Value": formatCurrency(c.lifetimeValue, primaryCurrency),
      Orders: c.orders,
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

  const isLoading = customersLoading;
  const isInitialLoading = customersLoading && effectivePage === 1;

  return {
    customers,
    exportData,
    isLoading,
    isInitialLoading,
    loadingStates,
  };
}
