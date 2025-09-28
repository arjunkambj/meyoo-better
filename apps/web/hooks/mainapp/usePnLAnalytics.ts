import { useMemo, useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { computeOverviewMetrics } from "@/libs/analytics/aggregations";
import type { AnalyticsSourceData } from "@/libs/analytics/aggregations";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useShopifyTime } from "./useShopifyTime";
import { useOrganizationTimeZone } from "./useUser";

import type { PnLKPIMetrics } from "@/components/dashboard/(analytics)/pnl/components/PnLKPICards";

export type PnLGranularity = "daily" | "weekly" | "monthly";

export interface PnLMetrics {
  grossSales: number;
  discounts: number;
  refunds: number;
  revenue: number;
  cogs: number;
  shippingCosts: number;
  transactionFees: number;
  handlingFees: number;
  grossProfit: number;
  taxesCollected: number;
  customCosts: number;
  totalAdSpend: number;
  netProfit: number;
  netProfitMargin: number;
}

export interface PnLTablePeriod {
  label: string;
  date: string;
  metrics: PnLMetrics;
  growth: {
    revenue: number;
    netProfit: number;
  } | null;
  isTotal?: boolean;
}

interface UsePnLAnalyticsParams {
  startDate?: string;
  endDate?: string;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("id" in (value as Record<string, unknown>) && typeof (value as any).id === "string") {
      return (value as any).id;
    }
    if ("_id" in (value as Record<string, unknown>) && typeof (value as any)._id === "string") {
      return (value as any)._id;
    }
  }
  return String(value ?? "");
}

function getDailyKey(date: Date): { key: string; label: string; date: string } {
  const iso = date.toISOString().slice(0, 10);
  return { key: iso, label: iso, date: iso };
}

function getWeeklyKey(date: Date): { key: string; label: string; date: string } {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = current.getUTCDay() || 7;
  if (day !== 1) {
    current.setUTCDate(current.getUTCDate() - day + 1);
  }
  const start = current.toISOString().slice(0, 10);
  const end = new Date(current.getTime());
  end.setUTCDate(end.getUTCDate() + 6);
  const endIso = end.toISOString().slice(0, 10);
  const label = `${start} – ${endIso}`;
  return { key: `${start}_${endIso}`, label, date: start };
}

function getMonthlyKey(date: Date): { key: string; label: string; date: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  return { key, label: key, date: `${key}-01` };
}

function getPeriodKey(date: Date, granularity: PnLGranularity) {
  switch (granularity) {
    case "weekly":
      return getWeeklyKey(date);
    case "monthly":
      return getMonthlyKey(date);
    case "daily":
    default:
      return getDailyKey(date);
  }
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

  const metricsArgs = useMemo(
    () => (utcDateRange ? { dateRange: utcDateRange } : ("skip" as const)),
    [utcDateRange],
  );
  const rawMetrics = useQuery(api.web.pnl.getMetrics, metricsArgs);

  const tableArgs = useMemo(
    () =>
      utcDateRange
        ? {
            dateRange: utcDateRange,
            granularity,
          }
        : ("skip" as const),
    [utcDateRange, granularity],
  );
  const rawTableSource = useQuery(api.web.pnl.getTableData, tableArgs);

  const overviewAggregation = useMemo(
    () => computeOverviewMetrics(rawMetrics ?? undefined),
    [rawMetrics],
  );

  const perOrderMetrics = useMemo(() => {
    const dataset = rawMetrics ?? rawTableSource;
    if (!dataset?.data) {
      return null;
    }

    const data = dataset.data as AnalyticsSourceData<any>;
    const orders = (data.orders || []) as any[];
    const orderItems = (data.orderItems || []) as any[];
    const transactions = (data.transactions || []) as any[];
    const metaInsights = (data.metaInsights || []) as any[];
    const refunds = (data.refunds || []) as any[];
    const productCostComponents = (data.productCostComponents || []) as any[];
    const variants = (data.variants || []) as any[];

    const variantMap = new Map<string, any>();
    for (const variant of variants) {
      variantMap.set(
        toStringId(variant._id ?? variant.id ?? variant.variantId),
        variant,
      );
    }

    const componentMap = new Map<string, any>();
    for (const component of productCostComponents) {
      const variantId = toStringId(component.variantId ?? component.variant_id);
      if (!variantId) continue;
      const current = componentMap.get(variantId);
      if (
        !current ||
        safeNumber(component.effectiveFrom) > safeNumber(current?.effectiveFrom)
      ) {
        componentMap.set(variantId, component);
      }
    }

    const orderItemsByOrder = new Map<string, any[]>();
    for (const item of orderItems) {
      const orderId = toStringId(item.orderId ?? item.order_id);
      if (!orderId) continue;
      const collection = orderItemsByOrder.get(orderId) ?? [];
      collection.push(item);
      orderItemsByOrder.set(orderId, collection);
    }

    const transactionsByOrder = new Map<string, any[]>();
    for (const tx of transactions) {
      const orderId = toStringId(tx.orderId ?? tx.order_id);
      if (!orderId) continue;
      const collection = transactionsByOrder.get(orderId) ?? [];
      collection.push(tx);
      transactionsByOrder.set(orderId, collection);
    }

    const refundsSet = new Set(
      refunds.map((refund) => toStringId(refund.orderId ?? refund.order_id)),
    );

    const totalAdSpend = safeNumber(
      overviewAggregation?.summary.totalAdSpend ??
        metaInsights.reduce((total, insight) => total + safeNumber(insight.spend), 0),
    );

    const perOrder = orders.map((orderRaw) => {
      const orderId = toStringId(orderRaw._id ?? orderRaw.id);
      const items = orderItemsByOrder.get(orderId) ?? [];
      const txs = transactionsByOrder.get(orderId) ?? [];

      const revenue = safeNumber(orderRaw.totalPrice);
      const grossSales = safeNumber(orderRaw.subtotalPrice ?? orderRaw.totalPrice);
      const discounts = safeNumber(orderRaw.totalDiscounts);
      const shippingCosts = safeNumber(orderRaw.totalShippingPrice);
      const taxesCollected = safeNumber(orderRaw.totalTax);

      let cogs = 0;
      for (const item of items) {
        const variantId = toStringId(item.variantId ?? item.variant_id);
        const component = componentMap.get(variantId);
        const variant = variantMap.get(variantId);
        const perUnit = safeNumber(
          component?.cogsPerUnit ?? component?.costPerUnit ?? variant?.costPerItem ?? 0,
        );
        cogs += perUnit * safeNumber(item.quantity);
      }

      const transactionFees = txs.reduce((total, tx) => total + safeNumber(tx.fee), 0);
      const handlingFees = 0;
      const customCosts = 0;

      const adSpendShare = 0; // Will distribute later based on revenue share

      const netProfit = revenue - (cogs + shippingCosts + transactionFees + handlingFees + customCosts + taxesCollected + adSpendShare);
      const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        orderId,
        date: new Date(safeNumber(orderRaw.shopifyCreatedAt ?? orderRaw.createdAt)),
        revenue,
        grossSales,
        discounts,
        refunds: refundsSet.has(orderId) ? safeNumber(orderRaw.refundTotal ?? 0) : 0,
        cogs,
        shippingCosts,
        transactionFees,
        handlingFees,
        taxesCollected,
        customCosts,
        adSpend: 0,
        netProfit,
        netProfitMargin,
      };
    });

    const totalRevenue = perOrder.reduce((total, order) => total + order.revenue, 0);
    const perOrderWithAdSpend = perOrder.map((order) => {
      const allocation = totalRevenue > 0 ? (order.revenue / totalRevenue) * totalAdSpend : 0;
      const netProfit =
        order.revenue -
        (order.cogs +
          order.shippingCosts +
          order.transactionFees +
          order.handlingFees +
          order.customCosts +
          order.taxesCollected +
          allocation);
      return {
        ...order,
        adSpend: allocation,
        netProfit,
        netProfitMargin: order.revenue > 0 ? (netProfit / order.revenue) * 100 : 0,
      };
    });

    return perOrderWithAdSpend;
  }, [rawMetrics, rawTableSource, overviewAggregation?.summary]);

  const kpiMetrics: PnLKPIMetrics | undefined = useMemo(() => {
    if (!overviewAggregation?.summary) return undefined;

    const summary = overviewAggregation.summary;
    const marketingCost = summary.totalAdSpend;
    const operatingExpenses =
      summary.shippingCosts +
      summary.transactionFees +
      summary.handlingFees +
      summary.customCosts +
      summary.taxesCollected +
      marketingCost;
    const netProfit = summary.profit;

    return {
      grossSales: summary.grossSales,
      discountsReturns: summary.discounts + summary.refunds,
      netRevenue: summary.revenue,
      grossProfit: summary.grossProfit,
      operatingExpenses,
      ebitda: netProfit,
      netProfit,
      netMargin: summary.profitMargin,
      marketingCost,
      marketingROAS: summary.roas,
      marketingROI: summary.roas,
      changes: {
        grossSales: 0,
        discountsReturns: 0,
        netRevenue: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        ebitda: 0,
        netProfit: 0,
        netMargin: 0,
        marketingCost: 0,
        marketingROAS: 0,
        marketingROI: 0,
      },
    };
  }, [overviewAggregation?.summary]);

  const tablePeriods: PnLTablePeriod[] | undefined = useMemo(() => {
    if (!perOrderMetrics?.length) return undefined;

    const groups = new Map<string, { key: string; label: string; date: string; orders: typeof perOrderMetrics }>();

    for (const entry of perOrderMetrics) {
      const keyInfo = getPeriodKey(entry.date, granularity);
      const bucket = groups.get(keyInfo.key);
      if (!bucket) {
        groups.set(keyInfo.key, {
          key: keyInfo.key,
          label: keyInfo.label,
          date: keyInfo.date,
          orders: [entry],
        });
      } else {
        bucket.orders.push(entry);
      }
    }

    const periods = Array.from(groups.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(({ key, label, date, orders }) => {
        const aggregate = orders.reduce(
          (acc, order) => {
            acc.grossSales += order.grossSales;
            acc.discounts += order.discounts;
            acc.refunds += order.refunds;
            acc.revenue += order.revenue;
            acc.cogs += order.cogs;
            acc.shippingCosts += order.shippingCosts;
            acc.transactionFees += order.transactionFees;
            acc.handlingFees += order.handlingFees;
            acc.taxesCollected += order.taxesCollected;
            acc.customCosts += order.customCosts;
            acc.totalAdSpend += order.adSpend;
            acc.netProfit += order.netProfit;
            return acc;
          },
          {
            grossSales: 0,
            discounts: 0,
            refunds: 0,
            revenue: 0,
            cogs: 0,
            shippingCosts: 0,
            transactionFees: 0,
            handlingFees: 0,
            taxesCollected: 0,
            customCosts: 0,
            totalAdSpend: 0,
            netProfit: 0,
          },
        );

        const metrics: PnLMetrics = {
          grossSales: aggregate.grossSales,
          discounts: aggregate.discounts,
          refunds: aggregate.refunds,
          revenue: aggregate.revenue,
          cogs: aggregate.cogs,
          shippingCosts: aggregate.shippingCosts,
          transactionFees: aggregate.transactionFees,
          handlingFees: aggregate.handlingFees,
          grossProfit: aggregate.revenue - aggregate.cogs,
          taxesCollected: aggregate.taxesCollected,
          customCosts: aggregate.customCosts,
          totalAdSpend: aggregate.totalAdSpend,
          netProfit: aggregate.netProfit,
          netProfitMargin:
            aggregate.revenue > 0 ? (aggregate.netProfit / aggregate.revenue) * 100 : 0,
        };

        return {
          label,
          date,
          metrics,
          growth: null,
        };
      });

    return periods;
  }, [perOrderMetrics, granularity]);

  const exportData = useMemo(() => {
    if (!kpiMetrics || !tablePeriods) return [];

    const rows: Record<string, unknown>[] = [];

    rows.push(
      { metric: "Gross Sales", value: kpiMetrics.grossSales },
      { metric: "Discounts & Returns", value: kpiMetrics.discountsReturns },
      { metric: "Net Revenue", value: kpiMetrics.netRevenue },
      { metric: "Gross Profit", value: kpiMetrics.grossProfit },
      { metric: "Operating Expenses", value: kpiMetrics.operatingExpenses },
      { metric: "EBITDA", value: kpiMetrics.ebitda },
      { metric: "Net Profit", value: kpiMetrics.netProfit },
      { metric: "Net Margin", value: kpiMetrics.netMargin },
      { metric: "Marketing Cost", value: kpiMetrics.marketingCost },
      { metric: "Marketing ROAS", value: kpiMetrics.marketingROAS },
      { metric: "Marketing ROI", value: kpiMetrics.marketingROI },
    );

    for (const period of tablePeriods) {
      rows.push({
        period: period.label,
        revenue: period.metrics.revenue,
        grossSales: period.metrics.grossSales,
        discounts: period.metrics.discounts,
        refunds: period.metrics.refunds,
        cogs: period.metrics.cogs,
        shipping: period.metrics.shippingCosts,
        transactionFees: period.metrics.transactionFees,
        adSpend: period.metrics.totalAdSpend,
        netProfit: period.metrics.netProfit,
        netMargin: period.metrics.netProfitMargin,
      });
    }

    return rows;
  }, [kpiMetrics, tablePeriods]);

  const loadingStates = {
    metrics: rawMetrics === undefined,
    table: rawTableSource === undefined,
  };

  const isLoading = Object.values(loadingStates).some(Boolean);

  return {
    granularity,
    setGranularity,
    metricsData: kpiMetrics,
    tablePeriods,
    exportData,
    isLoading,
    loadingStates,
  };
}
