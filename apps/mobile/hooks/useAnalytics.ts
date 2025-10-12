import { useEffect, useMemo, useState } from 'react';
import { useAction, useQuery } from 'convex/react';

import { api } from '@/libs/convexApi';
import { useDateRange } from '@/store/dateRangeStore';
import type {
  OverviewComputation,
  PlatformMetrics as PlatformMetricsResult,
  PnLAnalyticsResult,
  ChannelRevenueBreakdown,
} from '@repo/types';

type OverviewResponse = (
  | {
      overview?: OverviewComputation | null;
      platformMetrics?: PlatformMetricsResult | null;
      channelRevenue?: ChannelRevenueBreakdown | null;
      meta?: Record<string, unknown>;
      [key: string]: unknown;
    }
  | null
);

const overviewActionCache = new Map<string, OverviewResponse>();
const overviewActionPending = new Map<string, Promise<OverviewResponse>>();

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
  moMRevenueGrowth: AnalyticsMetric;
  ncRoas?: AnalyticsMetric;
  poas?: AnalyticsMetric;
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

function useDashboardOverviewData() {
  const { dateRange } = useDateRange();

  const queryArgs = useMemo(
    () => ({
      dateRange: {
        startDate: dateRange.start,
        endDate: dateRange.end,
      },
    }),
    [dateRange.end, dateRange.start],
  );

  const response = useQuery(api.web.dashboard.getOverviewData, queryArgs) as OverviewResponse | undefined;
  const fetchOverviewAction = useAction(api.web.dashboard.getOverviewDataAction);
  const [state, setState] = useState<{
    key: string | null;
    loading: boolean;
    data: OverviewResponse;
  }>({
    key: null,
    loading: false,
    data: null,
  });

  const currentKey = JSON.stringify(queryArgs.dateRange);
  const needsActionLoad = Boolean(
      response !== undefined &&
      response &&
      (response.meta as Record<string, unknown> | undefined)?.needsActionLoad,
  );

  useEffect(() => {
    if (!needsActionLoad) {
      if (state.key !== null || state.loading || state.data !== null) {
        setState({ key: null, loading: false, data: null });
      }
      return;
    }

    if (state.key === currentKey && (state.loading || state.data !== null)) {
      return;
    }

    if (overviewActionCache.has(currentKey)) {
      setState({
        key: currentKey,
        loading: false,
        data: overviewActionCache.get(currentKey) ?? null,
      });
      return;
    }

    let cancelled = false;
    setState({ key: currentKey, loading: true, data: null });

    let promise = overviewActionPending.get(currentKey);
    if (!promise) {
      promise = fetchOverviewAction({
        dateRange: queryArgs.dateRange,
      })
        .then((result) => {
          const normalized = result ?? null;
          overviewActionCache.set(currentKey, normalized);
          return normalized;
        })
        .catch((error) => {
          console.error('Failed to load dashboard overview via action:', error);
          overviewActionCache.delete(currentKey);
          throw error;
        })
        .finally(() => {
          overviewActionPending.delete(currentKey);
        });
      overviewActionPending.set(currentKey, promise);
    }

    promise
      .then((result) => {
        if (cancelled) return;
        setState({ key: currentKey, loading: false, data: result });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ key: currentKey, loading: false, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [
    needsActionLoad,
    currentKey,
    fetchOverviewAction,
    queryArgs.dateRange,
    state.key,
    state.loading,
    state.data,
  ]);

  const fallbackLoading = needsActionLoad && (state.loading || state.key !== currentKey);
  const data = needsActionLoad && state.key === currentKey
    ? state.data
    : (response ?? null);
  const isLoading = response === undefined || fallbackLoading;

  return {
    data,
    isLoading,
  } as const;
}

// ----- Overview analytics -----

export function useOverviewAnalytics() {
  const { data: overviewData, isLoading } = useDashboardOverviewData();

  const metrics = useMemo<OverviewMetrics | null>(() => {
    if (isLoading) return null;
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
        overviewSummary.blendedMarketingCost,
        overviewSummary.blendedMarketingCostChange,
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
      moMRevenueGrowth: createMetric(overviewSummary.moMRevenueGrowth ?? 0),
      ncRoas: createMetric(
        overviewSummary.ncROAS ?? 0,
        overviewSummary.ncROASChange,
      ),
      poas: createMetric(overviewSummary.poas ?? 0, overviewSummary.poasChange),
    } satisfies OverviewMetrics;
  }, [overviewData, isLoading]);

  return {
    metrics,
    isLoading,
    error: null,
  };
}

// ----- Cost breakdown -----

export function useCostBreakdown() {
  const { data: overviewData, isLoading } = useDashboardOverviewData();

  const breakdown = useMemo<CostBreakdownResult>(() => {
    if (isLoading) return EMPTY_COST_BREAKDOWN;
    const overviewSummary = overviewData?.overview?.summary;
    if (!overviewSummary) return EMPTY_COST_BREAKDOWN;

    return {
      totals: {
        adSpend: overviewSummary.blendedMarketingCost,
        cogs: overviewSummary.cogs,
        shipping: overviewSummary.shippingCosts,
        transaction: overviewSummary.transactionFees,
        custom: overviewSummary.customCosts,
        handling: overviewSummary.handlingFees,
      },
      metaSpend: overviewSummary.metaAdSpend,
    } satisfies CostBreakdownResult;
  }, [overviewData, isLoading]);

  return {
    totals: breakdown.totals,
    metaSpend: breakdown.metaSpend,
    isLoading,
  };
}

// ----- Platform metrics -----

export function usePlatformMetrics() {
  const { data: overviewData, isLoading } = useDashboardOverviewData();

  return {
    metrics: overviewData?.platformMetrics ?? null,
    isLoading,
  };
}

// ----- Channel revenue -----

export function useChannelRevenue() {
  const { data: overviewData, isLoading } = useDashboardOverviewData();

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
    isLoading,
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
