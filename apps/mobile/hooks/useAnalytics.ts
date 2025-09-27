import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import { api } from '@/libs/convexApi';
import { useDateRange } from '@/store/dateRangeStore';

// Define metric types
export interface AnalyticsMetric {
  value: number;
  change?: number;
  previousValue?: number;
}

export interface OverviewMetrics {
  revenue: AnalyticsMetric;
  orders: AnalyticsMetric;
  conversionRate: AnalyticsMetric;
  avgOrderValue: AnalyticsMetric;
  totalAdSpend: AnalyticsMetric;
  roas: AnalyticsMetric;
  customers: AnalyticsMetric;
  repeatRate: AnalyticsMetric;
  netProfit: AnalyticsMetric;
  profitMargin: AnalyticsMetric;
}

// Hook for overview analytics
export function useOverviewAnalytics() {
  const { dateRange } = useDateRange();

  // Fetch overview metrics - using getMetrics temporarily until we have the proper endpoint
  const overviewData = useQuery(
    api.web.analytics.getMetrics,
    {
      dateRange: {
        startDate: dateRange.start,
        endDate: dateRange.end,
      },
      metrics: ['revenue', 'orders', 'conversionRate', 'aov', 'totalAdSpend', 'blendedRoas', 'customers', 'repeatCustomerRate', 'netProfit', 'netProfitMargin'],
    }
  ) as any;

  // Transform the data into mobile-friendly format
  const metrics = useMemo<OverviewMetrics | null>(() => {
    if (!overviewData) return null;

    return {
      revenue: {
        value: overviewData.revenue?.value ?? 0,
        change: overviewData.revenue?.change ?? 0,
      },
      orders: {
        value: overviewData.orders?.value ?? 0,
        change: overviewData.orders?.change ?? 0,
      },
      conversionRate: {
        value: overviewData.conversionRate?.value ?? 0,
        change: overviewData.conversionRate?.change ?? 0,
      },
      avgOrderValue: {
        value: overviewData.aov?.value ?? 0,
        change: overviewData.aov?.change ?? 0,
      },
      totalAdSpend: {
        value: overviewData.totalAdSpend?.value ?? 0,
        change: overviewData.totalAdSpend?.change ?? 0,
      },
      roas: {
        value: overviewData.blendedRoas?.value ?? 0,
        change: overviewData.blendedRoas?.change ?? 0,
      },
      customers: {
        value: overviewData.customers?.value ?? 0,
        change: overviewData.customers?.change ?? 0,
      },
      repeatRate: {
        value: overviewData.repeatCustomerRate?.value ?? 0,
        change: overviewData.repeatCustomerRate?.change ?? 0,
      },
      netProfit: {
        value: overviewData.netProfit?.value ?? 0,
        change: overviewData.netProfit?.change ?? 0,
      },
      profitMargin: {
        value: overviewData.netProfitMargin?.value ?? 0,
        change: overviewData.netProfitMargin?.change ?? 0,
      },
    };
  }, [overviewData]);

  return {
    metrics,
    isLoading: overviewData === undefined,
    error: null,
  };
}

// Hook for platform-specific metrics
export function usePlatformMetrics() {
  // For now, return null for platform metrics until we have proper endpoints
  const shopifyMetrics = null as any;
  const metaMetrics = null as any;
  const googleMetrics = null as any;

  return {
    shopify: shopifyMetrics,
    meta: metaMetrics,
    google: googleMetrics,
    isLoading:
      shopifyMetrics === undefined ||
      metaMetrics === undefined ||
      googleMetrics === undefined,
  };
}

// Hook for channel revenue breakdown
export function useChannelRevenue() {
  const { dateRange } = useDateRange();

  const channelData = useQuery(
    api.web.analytics.getChannelRevenue,
    {
      dateRange: {
        startDate: dateRange.start,
        endDate: dateRange.end,
      },
    }
  );

  const channels = useMemo(() => {
    if (!channelData?.channels) return [];

    return channelData.channels.map((channel) => ({
      name: channel.name,
      revenue: channel.revenue ?? 0,
      orders: channel.orders ?? 0,
      change: channel.change ?? 0,
    }));
  }, [channelData]);

  return {
    channels,
    totalRevenue: channelData?.totalRevenue ?? 0,
    isLoading: channelData === undefined,
  };
}