import { useMemo, useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import type { PnLAnalyticsResult, PnLGranularity, PnLKPIMetrics, PnLTablePeriod } from "@repo/types";

interface UsePnLAnalyticsParams {
  startDate?: string;
  endDate?: string;
}

export function usePnLAnalytics(params?: UsePnLAnalyticsParams) {
  const [granularity, setGranularity] = useState<PnLGranularity>("daily");
  const {
    offsetMinutes,
    timezoneIana,
    isLoading: isShopTimeLoading,
  } = useShopifyTime();

  const defaultDateRange = useMemo<{ startDate: string; endDate: string }>(() => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    };
  }, []);

  const startDate = params?.startDate ?? defaultDateRange.startDate;
  const endDate = params?.endDate ?? defaultDateRange.endDate;

  const canRunQueries = !isShopTimeLoading;

  const utcDateRange = useMemo(() => {
    if (!canRunQueries) return undefined;
    const baseRange = { startDate, endDate } as const;
    const utcRange = dateRangeToUtcWithShopPreference(
      baseRange,
      typeof offsetMinutes === "number" ? offsetMinutes : undefined,
      timezoneIana,
    );

    return {
      ...utcRange,
      // Preserve the original shop-local date keys so daily metrics queries
      // align with how snapshots are stored (by local YYYY-MM-DD).
      startDate,
      endDate,
    };
  }, [canRunQueries, startDate, endDate, offsetMinutes, timezoneIana]);

  const args = useMemo(() => {
    if (!utcDateRange) return "skip" as const;
    return {
      dateRange: utcDateRange,
      granularity,
    };
  }, [utcDateRange, granularity]);

  const analytics = useQuery(api.web.pnl.getAnalytics, args);

  const result = analytics?.result as PnLAnalyticsResult | undefined;
  const resolvedDateRange = analytics?.dateRange ?? { startDate, endDate };
  const primaryCurrency =
    result?.primaryCurrency ??
    (typeof analytics?.meta === "object" && analytics?.meta !== null
      ? (analytics.meta as { primaryCurrency?: string }).primaryCurrency
      : undefined) ??
    "USD";
  const tableRange =
    result?.tableRange ??
    (typeof analytics?.meta === "object" && analytics?.meta !== null
      ? (analytics.meta as { tableRange?: { startDate: string; endDate: string } }).tableRange
      : undefined) ??
    resolvedDateRange;

  const metricsData: PnLKPIMetrics | undefined = result?.metrics ?? undefined;
  const tablePeriods: PnLTablePeriod[] | undefined = result?.periods ?? undefined;

  const loadingStates = {
    metrics: analytics === undefined,
    table: analytics === undefined,
  };

  return {
    metricsData,
    tablePeriods,
    granularity,
    setGranularity,
    loadingStates,
    dateRange: resolvedDateRange,
    primaryCurrency,
    tableRange,
  };
}
