import { useMemo } from 'react';
import { useQuery } from 'convex/react';

import { api } from '@/libs/convexApi';
import { useDateRange } from '@/store/dateRangeStore';
import type {
  OverviewComputation,
  PlatformMetrics as PlatformMetricsResult,
  PnLAnalyticsResult,
  ChannelRevenueBreakdown,
} from '@repo/types';

// ----- Metric types -----

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

const EMPTY_COST_BREAKDOWN: CostBreakdownResult = {
  totals: {
    adSpend: 0,
    cogs: 0,
    shipping: 0,
    transaction: 0,
    custom: 0,
    handling: 0,
  },
  metaSpend: 0,
};

const createMetric = (value: number, change?: number, previousValue?: number): AnalyticsMetric => ({
  value,
  change,
  previousValue,
});

// ----- Overview analytics -----

export function useOverviewAnalytics() {
  const { dateRange } = useDateRange();

  const overviewData = useQuery(api.web.dashboard.getOverviewData, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  }) as { overview?: OverviewComputation | null } | null | undefined;

  const metrics = useMemo<OverviewMetrics | null>(() => {
    if (overviewData === undefined) return null;
    const overviewSummary = overviewData?.overview?.summary;
    if (!overviewSummary) return null;

    return {
      revenue: createMetric(overviewSummary.revenue, overviewSummary.revenueChange),
      orders: createMetric(overviewSummary.orders, overviewSummary.ordersChange),
      avgOrderValue: createMetric(
        overviewSummary.avgOrderValue,
        overviewSummary.avgOrderValueChange,
      ),
      totalAdSpend: createMetric(
        overviewSummary.totalAdSpend,
        overviewSummary.totalAdSpendChange,
      ),
      roas: createMetric(overviewSummary.roas, overviewSummary.roasChange),
      customers: createMetric(overviewSummary.customers, overviewSummary.customersChange),
      repeatRate: createMetric(
        overviewSummary.repeatCustomerRate,
        overviewSummary.repeatCustomerRateChange,
      ),
      netProfit: createMetric(overviewSummary.profit, overviewSummary.profitChange),
      grossProfit: createMetric(
        overviewSummary.grossProfit,
        overviewSummary.grossProfitChange,
      ),
      profitMargin: createMetric(
        overviewSummary.profitMargin,
        overviewSummary.profitMarginChange,
      ),
    } satisfies OverviewMetrics;
  }, [overviewData]);

  return {
    metrics,
    isLoading: overviewData === undefined,
    error: null,
  };
}

// ----- Cost breakdown -----

export function useCostBreakdown() {
  const { dateRange } = useDateRange();

  const overviewData = useQuery(api.web.dashboard.getOverviewData, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  }) as { overview?: OverviewComputation | null } | null | undefined;

  const breakdown = useMemo<CostBreakdownResult>(() => {
    if (overviewData === undefined) return EMPTY_COST_BREAKDOWN;
    const overviewSummary = overviewData?.overview?.summary;
    if (!overviewSummary) return EMPTY_COST_BREAKDOWN;

    return {
      totals: {
        adSpend: overviewSummary.totalAdSpend,
        cogs: overviewSummary.cogs,
        shipping: overviewSummary.shippingCosts,
        transaction: overviewSummary.transactionFees,
        custom: overviewSummary.customCosts,
        handling: overviewSummary.handlingFees,
      },
      metaSpend: overviewSummary.metaAdSpend,
    } satisfies CostBreakdownResult;
  }, [overviewData]);

  return {
    totals: breakdown.totals,
    metaSpend: breakdown.metaSpend,
    isLoading: overviewData === undefined,
  };
}

// ----- Platform metrics -----

export function usePlatformMetrics() {
  const { dateRange } = useDateRange();

  const overviewData = useQuery(api.web.dashboard.getOverviewData, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  }) as { platformMetrics?: PlatformMetricsResult | null } | null | undefined;

  return {
    metrics: overviewData?.platformMetrics ?? null,
    isLoading: overviewData === undefined,
  };
}

// ----- Channel revenue -----

export function useChannelRevenue() {
  const { dateRange } = useDateRange();

  const overviewData = useQuery(api.web.dashboard.getOverviewData, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  }) as { channelRevenue?: ChannelRevenueBreakdown | null } | null | undefined;

  const channels = useMemo(() => {
    const breakdown = overviewData?.channelRevenue?.channels ?? [];
    return breakdown.map((channel) => ({
      name: channel.name,
      revenue: channel.revenue,
      orders: channel.orders,
      change: channel.change,
    }));
  }, [overviewData]);

  const totalRevenue = useMemo(
    () => channels.reduce((sum, channel) => sum + channel.revenue, 0),
    [channels],
  );

  return {
    channels,
    totalRevenue,
    isLoading: overviewData === undefined,
  };
}

// ----- P&L summary -----

export function usePnLSummary() {
  const { dateRange } = useDateRange();

  const pnl = useQuery(api.web.pnl.getAnalytics, {
    dateRange: {
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
    granularity: 'monthly',
  }) as { result: PnLAnalyticsResult } | null | undefined;

  return {
    metrics: pnl?.result?.metrics ?? null,
    totals: pnl?.result?.totals ?? null,
    isLoading: pnl === undefined,
  };
}
