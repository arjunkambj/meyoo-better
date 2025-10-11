"use client";

import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import type { JourneyStage } from "@/components/dashboard/(analytics)/orders-insights/components/CustomerJourney";
import type { OrdersFulfillmentMetrics, OrdersOverviewMetrics } from "@repo/types";

type MetricWithChange = {
  value: number;
  change: number;
};

type RawJourneyStage = {
  stage: string;
  customers: number;
  percentage: number;
  avgDays: number;
  conversionRate: number;
  icon: string;
  color: string;
  metaConversionRate?: number;
};

export interface OrdersInsightsKPIs {
  prepaidRate: MetricWithChange;
  repeatRate: MetricWithChange;
  rtoRevenueLoss: MetricWithChange;
  abandonedCustomers: MetricWithChange;
  fulfillmentRate: MetricWithChange;
}

interface UseOrdersInsightsParams {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

interface OrdersInsightsResult {
  kpis: OrdersInsightsKPIs | null;
  fulfillment: OrdersFulfillmentMetrics | null;
  journey: JourneyStage[];
  cancelRate: number;
  returnRate: number;
  exportData: Record<string, unknown>[];
  loading: boolean;
}

function normalizeJourneyStages(raw: RawJourneyStage[] | undefined): JourneyStage[] {
  if (!raw) return [];

  const colorMap: Record<string, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    secondary: { bg: "bg-secondary/10", text: "text-secondary" },
    success: { bg: "bg-success/10", text: "text-success" },
    warning: { bg: "bg-warning/10", text: "text-warning" },
    danger: { bg: "bg-danger/10", text: "text-danger" },
    info: { bg: "bg-info/10", text: "text-info" },
    interest: {
      bg: "bg-sky-100 dark:bg-sky-500/15",
      text: "text-sky-700 dark:text-sky-200",
    },
    retention: {
      bg: "bg-emerald-100 dark:bg-emerald-500/15",
      text: "text-emerald-700 dark:text-emerald-200",
    },
    default: { bg: "bg-default-100", text: "text-default-500" },
  };

  return raw.map((stage) => {
    const palette = (colorMap[stage.color] ?? colorMap.default)!;
    return {
      ...stage,
      bgColor: palette.bg,
      textColor: palette.text,
    };
  });
}

function buildKpis(metrics: OrdersOverviewMetrics | null): OrdersInsightsKPIs | null {
  if (!metrics) return null;

  return {
    prepaidRate: {
      value: metrics.prepaidRate ?? 0,
      change: metrics.changes.prepaidRate ?? 0,
    },
    repeatRate: {
      value: metrics.repeatRate ?? 0,
      change: metrics.changes.repeatRate ?? 0,
    },
    rtoRevenueLoss: {
      value: metrics.rtoRevenueLoss ?? 0,
      change: metrics.changes.rtoRevenueLoss ?? 0,
    },
    abandonedCustomers: {
      value: metrics.abandonedCustomers ?? 0,
      change: metrics.changes.abandonedCustomers ?? 0,
    },
    fulfillmentRate: {
      value: metrics.fulfillmentRate ?? 0,
      change: metrics.changes.fulfillmentRate ?? 0,
    },
  };
}

export function useOrdersInsights(
  params: UseOrdersInsightsParams = {},
): OrdersInsightsResult {
  const { offsetMinutes } = useShopifyTime();

  const { dateRange } = params;

  const effectiveRange = useMemo(() => {
    if (dateRange) return dateRange;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [dateRange?.startDate, dateRange?.endDate]);

  const normalizedRange = useMemo(() => {
    if (!effectiveRange) return null;
    const rangeStrings = dateRangeToUtcWithShopPreference(
      effectiveRange,
      typeof offsetMinutes === "number" ? offsetMinutes : undefined,
    );

    if (!rangeStrings) return null;

    return {
      startDate: effectiveRange.startDate,
      endDate: effectiveRange.endDate,
      startDateTimeUtc: rangeStrings.startDateTimeUtc,
      endDateTimeUtcExclusive: rangeStrings.endDateTimeUtcExclusive,
    } as const;
  }, [effectiveRange, offsetMinutes]);

  const queryArgs = useMemo(() => {
    if (!normalizedRange) return "skip" as const;
    return { dateRange: normalizedRange } as const;
  }, [
    normalizedRange?.startDate,
    normalizedRange?.endDate,
    normalizedRange?.startDateTimeUtc,
    normalizedRange?.endDateTimeUtcExclusive,
  ]);

  const overviewResult = useQuery(
    api.web.orders.getOrdersOverviewMetrics,
    queryArgs,
  ) as ({ metrics: OrdersOverviewMetrics } | null | undefined);

  const fulfillmentResult = useQuery(
    api.web.orders.getFulfillmentMetrics,
    queryArgs,
  ) as OrdersFulfillmentMetrics | null | undefined;

  const journeyRaw = useQuery(
    (api.web.customers as Record<string, any>).getCustomerJourney,
    queryArgs,
  ) as RawJourneyStage[] | undefined;

  const overview = overviewResult?.metrics ?? null;
  const fulfillment = fulfillmentResult ?? null;
  const journey = useMemo(
    () => normalizeJourneyStages(journeyRaw),
    [journeyRaw],
  );

  const overviewLoading = queryArgs !== "skip" && overviewResult === undefined;
  const fulfillmentLoading = queryArgs !== "skip" && fulfillmentResult === undefined;
  const journeyLoading = queryArgs !== "skip" && journeyRaw === undefined;
  const loading = queryArgs !== "skip" && (overviewLoading || fulfillmentLoading || journeyLoading);

  const kpis = useMemo(() => buildKpis(overview), [overview]);

  const cancelRate = useMemo(() => {
    if (!overview || !overview.totalOrders || overview.totalOrders <= 0) {
      return 0;
    }
    const cancelled = overview.cancelledOrders ?? 0;
    return (cancelled / overview.totalOrders) * 100;
  }, [overview]);

  const returnRate = fulfillment?.returnRate ?? 0;

  const exportData = useMemo(() => {
    if (!kpis) return [] as Record<string, unknown>[];

    return [
      {
        Metric: "Prepaid Rate",
        Value: `${kpis.prepaidRate.value.toFixed(2)}%`,
        Change: `${kpis.prepaidRate.change.toFixed(2)}%`,
      },
      {
        Metric: "Repeat Rate",
        Value: `${kpis.repeatRate.value.toFixed(2)}%`,
        Change: `${kpis.repeatRate.change.toFixed(2)}%`,
      },
      {
        Metric: "Return/RTO Revenue Loss",
        Value: kpis.rtoRevenueLoss.value,
        Change: `${kpis.rtoRevenueLoss.change.toFixed(2)}%`,
      },
      {
        Metric: "Abandoned Customers",
        Value: kpis.abandonedCustomers.value,
        Change: `${kpis.abandonedCustomers.change.toFixed(2)}%`,
      },
      {
        Metric: "Fulfillment Rate",
        Value: `${kpis.fulfillmentRate.value.toFixed(2)}%`,
        Change: `${kpis.fulfillmentRate.change.toFixed(2)}%`,
      },
    ];
  }, [kpis]);

  return {
    kpis,
    fulfillment,
    journey,
    cancelRate,
    returnRate,
    exportData,
    loading,
  };
}
