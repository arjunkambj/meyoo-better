import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useAction } from "convex/react";

import { api } from "@/libs/convexApi";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";
import type {
  AnalyticsOrder,
  OrdersAnalyticsExportRow,
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
  };
}

interface OrdersPageSnapshot {
  page: AnalyticsOrder[];
  continueCursor: string;
  isDone: boolean;
  info: {
    pageSize: number;
    returned: number;
    hasMore: boolean;
  };
}

const END_CURSOR = "__end__";

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
    if (!effectiveRange) return null;
    return toUtcRangeStrings(effectiveRange, timezone);
  }, [effectiveRange, timezone]);

  // Use consolidated action for overview and fulfillment metrics
  const [metricsData, setMetricsData] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const fetchMetrics = useAction(api.web.orders.getOrdersMetrics);

  useEffect(() => {
    if (!rangeStrings) {
      setIsLoadingMetrics(false);
      return;
    }

    let cancelled = false;
    setIsLoadingMetrics(true);

    fetchMetrics({
      dateRange: rangeStrings,
    })
      .then((result) => {
        if (!cancelled) {
          setMetricsData(result);
          setIsLoadingMetrics(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load orders metrics:", error);
        if (!cancelled) {
          setIsLoadingMetrics(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchMetrics, rangeStrings?.startDate, rangeStrings?.endDate]);

  const overview: OrdersOverviewMetrics | null = metricsData?.overview?.metrics ?? null;

  const cursorKey = useMemo(() => {
    if (!rangeStrings) return null;
    return JSON.stringify({
      start: rangeStrings.startDate,
      end: rangeStrings.endDate,
      status: status ?? null,
      search: normalizedSearch ?? null,
      sortBy: sortBy ?? null,
      sortOrder,
      pageSize,
    });
  }, [rangeStrings?.startDate, rangeStrings?.endDate, status, normalizedSearch, sortBy, sortOrder, pageSize]);

  const cursorMapRef = useRef<Record<number, string | null>>({ 1: null });
  const lastCursorKeyRef = useRef<string | null>(null);
  const highestPageRef = useRef(1);
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const [cursorRevision, setCursorRevision] = useState(0);
  const maxKnownPageRef = useRef<number | null>(null);
  const [maxKnownPageVersion, setMaxKnownPageVersion] = useState(0);
  const prefetchInFlightRef = useRef<number | null>(null);
  const [prefetchPage, setPrefetchPage] = useState<number | null>(null);

  useEffect(() => {
    if (!cursorKey || lastCursorKeyRef.current === cursorKey) {
      return;
    }
    lastCursorKeyRef.current = cursorKey;
    cursorMapRef.current = { 1: null };
    highestPageRef.current = 1;
    setEstimatedTotal(0);
    prefetchInFlightRef.current = null;
    setPrefetchPage(null);
    maxKnownPageRef.current = null;
    setCursorRevision((prev) => prev + 1);
    setMaxKnownPageVersion((prev) => prev + 1);
  }, [cursorKey]);

  const effectivePage = useMemo(() => {
    const maxKnown = maxKnownPageRef.current;
    if (typeof maxKnown === "number" && maxKnown >= 1 && requestedPage > maxKnown) {
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

  const ordersQueryArgs = useMemo(() => {
    if (!rangeStrings || waitingForCursor) return "skip" as const;
    return {
      dateRange: rangeStrings,
      status,
      searchTerm: normalizedSearch,
      sortBy,
      sortOrder,
      paginationOpts: {
        cursor: currentCursor,
        numItems: pageSize,
      },
    };
  }, [rangeStrings, status, normalizedSearch, sortBy, sortOrder, currentCursor, pageSize, waitingForCursor]);

  const ordersPageSnapshot = useQuery(
    (api.web.orders as Record<string, any>).getOrdersTablePage,
    ordersQueryArgs,
  ) as OrdersPageSnapshot | undefined;

  useEffect(() => {
    if (!rangeStrings) {
      return;
    }

    if (prefetchInFlightRef.current !== null) {
      return;
    }

    const targetPage = effectivePage;
    for (let candidate = 2; candidate <= targetPage; candidate++) {
      if (!(candidate in cursorMapRef.current)) {
        const predecessor = candidate - 1;
        if (predecessor <= 1) {
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
  }, [effectivePage, rangeStrings, cursorRevision, prefetchPage]);

  const prefetchQueryArgs = useMemo(() => {
    if (!rangeStrings || prefetchPage === null) return "skip" as const;
    if (!(prefetchPage in cursorMapRef.current)) return "skip" as const;
    const cursor = cursorMapRef.current[prefetchPage];
    if (prefetchPage > 1 && cursor === null) return "skip" as const;

    return {
      dateRange: rangeStrings,
      status,
      searchTerm: normalizedSearch,
      sortBy,
      sortOrder,
      paginationOpts: {
        cursor,
        numItems: pageSize,
      },
    };
  }, [rangeStrings, status, normalizedSearch, sortBy, sortOrder, prefetchPage, pageSize, cursorRevision]);

  const prefetchSnapshot = useQuery(
    (api.web.orders as Record<string, any>).getOrdersTablePage,
    prefetchQueryArgs,
  ) as OrdersPageSnapshot | undefined;

  // Fulfillment metrics now come from consolidated action

  useEffect(() => {
    if (!ordersPageSnapshot) return;

    const isNewHighPage = effectivePage >= highestPageRef.current;
    highestPageRef.current = Math.max(highestPageRef.current, effectivePage);

    let cursorMapChanged = false;
    const nextPageIndex = effectivePage + 1;

    if (!ordersPageSnapshot.isDone && ordersPageSnapshot.continueCursor !== END_CURSOR) {
      const nextCursor = ordersPageSnapshot.continueCursor;
      if (cursorMapRef.current[nextPageIndex] !== nextCursor) {
        cursorMapRef.current[nextPageIndex] = nextCursor;
        cursorMapChanged = true;
      }
    } else {
      if (nextPageIndex in cursorMapRef.current) {
        delete cursorMapRef.current[nextPageIndex];
        cursorMapChanged = true;
      }

      if (ordersPageSnapshot.isDone) {
        const maxPage = effectivePage;
        if (maxKnownPageRef.current === null || maxKnownPageRef.current < maxPage) {
          maxKnownPageRef.current = maxPage;
          setMaxKnownPageVersion((prev) => prev + 1);
        }
      }
    }

    if (isNewHighPage) {
      if (ordersPageSnapshot.isDone) {
        const total = (effectivePage - 1) * pageSize + ordersPageSnapshot.page.length;
        setEstimatedTotal(total);
      } else {
        setEstimatedTotal((prev) => Math.max(prev, (effectivePage + 1) * pageSize));
      }
    }

    if (cursorMapChanged) {
      setCursorRevision((prev) => prev + 1);
    }
  }, [ordersPageSnapshot, effectivePage, pageSize]);

  useEffect(() => {
    const pageBeingPrefetched = prefetchInFlightRef.current;
    if (!prefetchSnapshot || pageBeingPrefetched === null) {
      return;
    }

    let cursorMapChanged = false;
    const nextPageIndex = pageBeingPrefetched + 1;

    if (!prefetchSnapshot.isDone && prefetchSnapshot.continueCursor !== END_CURSOR) {
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

    const isNewHighPage = pageBeingPrefetched >= highestPageRef.current;
    highestPageRef.current = Math.max(highestPageRef.current, pageBeingPrefetched);

    if (isNewHighPage) {
      if (prefetchSnapshot.isDone) {
        const total = (pageBeingPrefetched - 1) * pageSize + prefetchSnapshot.page.length;
        setEstimatedTotal((prev) => Math.max(prev, total));
      } else {
        setEstimatedTotal((prev) => Math.max(prev, (pageBeingPrefetched + 1) * pageSize));
      }
    }

    if (cursorMapChanged) {
      setCursorRevision((prev) => prev + 1);
    }

    prefetchInFlightRef.current = null;
    setPrefetchPage(null);
  }, [prefetchSnapshot, pageSize]);

  const orders: OrdersResult | undefined = useMemo(() => {
    if (!ordersPageSnapshot) return undefined;
    const baseTotal = ordersPageSnapshot.isDone
      ? (effectivePage - 1) * pageSize + ordersPageSnapshot.page.length
      : Math.max(estimatedTotal, (effectivePage + 1) * pageSize);
    const total = Math.max(baseTotal, ordersPageSnapshot.page.length, estimatedTotal);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: ordersPageSnapshot.page,
      pagination: {
        page: effectivePage,
        pageSize,
        total,
        totalPages,
      },
    };
  }, [ordersPageSnapshot, estimatedTotal, effectivePage, pageSize]);

  const fulfillmentMetrics: OrdersFulfillmentMetrics | undefined = useMemo(() => {
    if (isLoadingMetrics) return undefined;
    return metricsData?.fulfillment ?? undefined;
  }, [isLoadingMetrics, metricsData]);

  const exportData: OrdersAnalyticsExportRow[] = useMemo(() => {
    if (!ordersPageSnapshot) return [];
    return ordersPageSnapshot.page.map((order) => ({
      "Order Number": order.orderNumber,
      Customer: order.customer.name,
      Email: order.customer.email,
      Status: order.status,
      "Fulfillment Status": order.fulfillmentStatus,
      "Financial Status": order.financialStatus,
      Items: order.items,
      Revenue: order.totalPrice,
      Costs: order.totalCost,
      Profit: order.profit,
      "Profit Margin": order.profitMargin,
      Shipping: order.shippingCost,
      Tax: order.taxAmount,
      Payment: order.paymentMethod,
      "Ship To": `${order.shippingAddress.city}, ${order.shippingAddress.country}`.trim(),
      "Created At": order.createdAt,
      "Updated At": order.updatedAt,
    }));
  }, [ordersPageSnapshot]);

  const overviewLoading = isLoadingMetrics;
  const ordersLoading = ordersQueryArgs !== "skip" && ordersPageSnapshot === undefined;
  const fulfillmentLoading = isLoadingMetrics;

  const loadingStates = {
    overview: overviewLoading,
    orders: ordersLoading,
    fulfillment: fulfillmentLoading,
  };

  const isLoading = isLoadingMetrics || ordersLoading;
  const isInitialLoading = ordersLoading && effectivePage === 1;

  return {
    overview: overview ?? undefined,
    orders,
    fulfillmentMetrics,
    exportData,
    isLoading,
    isInitialLoading,
    loadingStates,
    orderOverview: overview,
  };
}
