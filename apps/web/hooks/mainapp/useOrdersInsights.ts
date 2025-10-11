"use client";

import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import type { JourneyStage } from "@/components/dashboard/(analytics)/orders-insights/components/CustomerJourney";
import type {
  OrdersFulfillmentMetrics,
  OrdersInsightsKPIs,
  OrdersInsightsPayload,
  OrdersJourneyStage,
} from "@repo/types";

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

function normalizeJourneyStages(raw: OrdersJourneyStage[] | undefined): JourneyStage[] {
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

  const insightsResult = useQuery(
    api.web.orders.getOrdersInsights,
    queryArgs,
  ) as OrdersInsightsPayload | null | undefined;

  const loading =
    queryArgs !== "skip" && insightsResult === undefined;

  const kpis = insightsResult?.kpis ?? null;
  const fulfillment = insightsResult?.fulfillment ?? null;
  const journeyRaw = insightsResult?.journey ?? [];
  const journey = useMemo(
    () => normalizeJourneyStages(journeyRaw),
    [journeyRaw],
  );

  const cancelRate = insightsResult?.cancelRate ?? 0;
  const returnRate = insightsResult?.returnRate ?? 0;

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
        Value: Number.isFinite(kpis.rtoRevenueLoss.value)
          ? kpis.rtoRevenueLoss.value.toFixed(2)
          : "0.00",
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
