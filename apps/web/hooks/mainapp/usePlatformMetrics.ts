import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { computePlatformMetrics } from "@/libs/analytics/aggregations";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import { useOrganizationTimeZone } from "./useUser";

type DateRange =
  | {
      start: string;
      end: string;
    }
  | null
  | undefined;

export function usePlatformMetrics(dateRange: DateRange) {
  const { offsetMinutes } = useShopifyTime();
  const { timezone } = useOrganizationTimeZone();
  // Fetch real platform metrics from the API
  const metrics = useQuery(
    api.web.analytics.getPlatformMetrics,
    dateRange
      ? {
          dateRange: dateRangeToUtcWithShopPreference(
            dateRange as any,
            offsetMinutes,
            timezone,
          ),
        }
      : ("skip" as const),
  );

  // Return loading state while fetching
  const computed = useMemo(() => computePlatformMetrics(metrics), [metrics]);

  if (metrics === undefined) {
    return { ...computed, isLoading: true };
  }

  return { ...computed, isLoading: false };
}
