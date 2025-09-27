import { useQuery } from "convex-helpers/react/cache/hooks";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import { useOrganizationTimeZone } from "./useUser";

import { api } from "@/libs/convexApi";

type DateRange = {
  start: string;
  end: string;
} | null;

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
      : {},
  );

  // Return loading state while fetching
  if (metrics === undefined) {
    return {
      isLoading: true,
      // Return zeros while loading to prevent UI issues
      shopifySessions: 0,
      shopifyConversion: 0,
      shopifyAbandonedCarts: 0,
      shopifyCheckoutRate: 0,
      metaSessions: 0,
      metaClicks: 0,
      metaConversion: 0,
      metaConversionRate: 0,
      metaImpressions: 0,
      metaCTR: 0,
      metaCPM: 0,
      metaReach: 0,
      metaFrequency: 0,
      metaUniqueClicks: 0,
      metaCPC: 0,
      metaCostPerConversion: 0,
      metaAddToCart: 0,
      metaInitiateCheckout: 0,
      metaPageViews: 0,
      metaViewContent: 0,
      metaLinkClicks: 0,
      metaOutboundClicks: 0,
      metaLandingPageViews: 0,
      metaVideoViews: 0,
      metaVideo3SecViews: 0,
      metaCostPerThruPlay: 0,
      blendedCPM: 0,
      blendedCPC: 0,
      blendedCTR: 0,
    };
  }

  // Return actual data from the API
  return {
    ...metrics,
    // Rename conversion rate fields to match the expected format
    shopifyConversion: metrics?.shopifyConversionRate || 0,
    metaConversion: metrics?.metaConversion || 0,
    metaConversionRate: metrics?.metaConversion || 0,
    metaClicks: (metrics as any)?.metaSessions || 0,
    isLoading: false,
  };
}
