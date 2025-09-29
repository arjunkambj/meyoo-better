import { useMemo, useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import { useOrganizationTimeZone } from "./useUser";
import type { PnLAnalyticsResult, PnLGranularity, PnLKPIMetrics, PnLTablePeriod } from "@repo/types";

interface UsePnLAnalyticsParams {
  startDate?: string;
  endDate?: string;
}

export function usePnLAnalytics(params?: UsePnLAnalyticsParams) {
  const [granularity, setGranularity] = useState<PnLGranularity>("monthly");
  const { offsetMinutes, isLoading: isShopTimeLoading } = useShopifyTime();
  const { timezone, loading: isTimezoneLoading } = useOrganizationTimeZone();

  const defaultDateRange = useMemo<{ startDate: string; endDate: string }>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    };
  }, []);

  const startDate = params?.startDate ?? defaultDateRange.startDate;
  const endDate = params?.endDate ?? defaultDateRange.endDate;

  const canRunQueries = !isShopTimeLoading && !isTimezoneLoading;

  const utcDateRange = useMemo(() => {
    if (!canRunQueries) return undefined;
    return dateRangeToUtcWithShopPreference(
      { startDate, endDate },
      offsetMinutes,
      timezone,
    );
  }, [canRunQueries, startDate, endDate, offsetMinutes, timezone]);

  const args = useMemo(() => {
    if (!utcDateRange) return "skip" as const;
    return {
      dateRange: utcDateRange,
      granularity,
    };
  }, [utcDateRange, granularity]);

  const analytics = useQuery(api.web.pnl.getAnalytics, args);

  const result = analytics?.result as PnLAnalyticsResult | undefined;

  const metricsData: PnLKPIMetrics | undefined = result?.metrics ?? undefined;
  const tablePeriods: PnLTablePeriod[] | undefined = result?.periods ?? undefined;
  const exportData = result?.exportRows ?? [];

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
    exportData,
  };
}
