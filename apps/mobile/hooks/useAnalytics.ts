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
  avgOrderValue: AnalyticsMetric;
  totalAdSpend: AnalyticsMetric;
  roas?: AnalyticsMetric;
  customers?: AnalyticsMetric;
  repeatRate?: AnalyticsMetric;
  netProfit: AnalyticsMetric;
  grossProfit: AnalyticsMetric;
  profitMargin: AnalyticsMetric;
}

export interface CostBreakdownTotals {
  adSpend: number;
  cogs: number;
  shipping: number;
  transaction: number;
  custom: number;
  handling: number;
}

interface CostBreakdownResult {
  totals: CostBreakdownTotals;
  metaSpend: number;
}

const createEmptyCostBreakdown = (): CostBreakdownResult => ({
  totals: {
    adSpend: 0,
    cogs: 0,
    shipping: 0,
    transaction: 0,
    custom: 0,
    handling: 0,
  },
  metaSpend: 0,
});

// Hook for overview analytics
export function useOverviewAnalytics() {
  const { dateRange } = useDateRange();

  // Aggregated P&L metrics for totals and period-over-period change
  const pnl = useQuery(api.web.pnl.getMetrics, {
    dateRange: {
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
  }) as any;

  // Fetch orders separately and sum them to avoid averaging artifacts
  const ordersRows = useQuery(api.web.analytics.getMetrics, {
    dateRange: {
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
    metrics: ["orders"],
  }) as any[] | null | undefined;

  // Fetch ROAS as an optional KPI (averaged across the period)
  const roasRows = useQuery(api.web.analytics.getMetrics, {
    dateRange: {
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
    metrics: ["blendedRoas"],
  }) as any[] | null | undefined;

  const metrics = useMemo<OverviewMetrics | null>(() => {
    if (pnl === undefined || ordersRows === undefined || roasRows === undefined)
      return null;
    if (pnl === null) return null;

    const ordersTotal = Array.isArray(ordersRows)
      ? ordersRows.reduce((sum, r) => sum + (Number(r?.orders) || 0), 0)
      : 0;

    const roasAvg = Array.isArray(roasRows) && roasRows.length > 0
      ? roasRows.reduce((sum, r) => sum + (Number(r?.blendedRoas) || 0), 0) /
        roasRows.length
      : 0;

    const revenue = Number(pnl.revenue || 0);
    const netProfit = Number(pnl.netProfit || 0);
    const totalAdSpend = Number(pnl.totalAdSpend || 0);
    const grossProfit = Number(pnl.grossProfit || 0);
    const profitMargin = Number(pnl.netProfitMargin || 0);
    const aov = ordersTotal > 0 ? revenue / ordersTotal : 0;

    return {
      revenue: {
        value: revenue,
        change: Number(pnl.revenueChange ?? 0),
      },
      orders: {
        value: ordersTotal,
        // Not currently available from P&L; omit change to hide indicator
      },
      avgOrderValue: {
        value: aov,
        // Change not computed; omit for now
      },
      totalAdSpend: {
        value: totalAdSpend,
        change: Number(pnl.totalAdSpendChange ?? 0),
      },
      roas: {
        value: roasAvg,
      },
      netProfit: {
        value: netProfit,
        change: Number(pnl.netProfitChange ?? 0),
      },
      grossProfit: {
        value: grossProfit,
        change: Number(pnl.grossProfitChange ?? 0),
      },
      profitMargin: {
        value: profitMargin,
        change: Number(pnl.netProfitMarginChange ?? 0),
      },
    };
  }, [pnl, ordersRows, roasRows]);

  return {
    metrics,
    isLoading:
      pnl === undefined || ordersRows === undefined || roasRows === undefined,
    error: null,
  };
}

// Hook: mobile cost breakdown (6 categories like web)
export function useCostBreakdown() {
  const { dateRange } = useDateRange();

  const costs = useQuery(
    api.web.analytics.getMetrics,
    {
      dateRange: { startDate: dateRange.start, endDate: dateRange.end },
      metrics: [
        'totalAdSpend',
        'cogs',
        'shippingCosts',
        'transactionFees',
        'customCosts',
        'handlingFees',
        // channel spends for KPIs
        'metaAdSpend',
      ],
    }
  ) as any[] | null | undefined;

  const { totals, metaSpend } = useMemo<CostBreakdownResult>(() => {
    if (!Array.isArray(costs)) return createEmptyCostBreakdown();
    const sum = (key: string) =>
      costs.reduce((acc: number, row: any) => acc + (Number(row?.[key]) || 0), 0);
    return {
      totals: {
        adSpend: sum('totalAdSpend'),
        cogs: sum('cogs'),
        shipping: sum('shippingCosts'),
        transaction: sum('transactionFees'),
        custom: sum('customCosts'),
        handling: sum('handlingFees'),
      } as CostBreakdownTotals,
      metaSpend: sum('metaAdSpend'),
    };
  }, [costs]);

  return {
    totals,
    metaSpend,
    isLoading: costs === undefined,
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
