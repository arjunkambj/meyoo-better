import type {
  AnalyticsDatasetKey,
  AnalyticsSourceResponse,
  PnLAnalyticsResult,
  PnLGranularity,
  PnLKPIMetrics,
  PnLMetrics,
  PnLTablePeriod,
} from '@repo/types';

import type { AnyRecord } from './shared';
import {
  computeCostOverlap,
  computeCostRetentionFactor,
  ensureDataset,
  filterAccountLevelMetaInsights,
  getFrequencyDurationMs,
  resolveManualReturnRate,
  safeNumber,
  sumBy,
} from './shared';

function getPeriodKey(date: Date, granularity: PnLGranularity) {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  switch (granularity) {
    case "weekly": {
      const current = new Date(base.getTime());
      const day = current.getUTCDay() || 7;
      if (day !== 1) {
        current.setUTCDate(current.getUTCDate() - day + 1);
      }

      const endLabelDate = new Date(current.getTime());
      endLabelDate.setUTCDate(endLabelDate.getUTCDate() + 6);

      const endRange = new Date(endLabelDate.getTime());
      endRange.setUTCHours(23, 59, 59, 999);

      const startIso = current.toISOString().slice(0, 10);
      const endIso = endLabelDate.toISOString().slice(0, 10);

      return {
        key: `${startIso}_${endIso}`,
        label: `${startIso} – ${endIso}`,
        date: startIso,
        rangeStartMs: current.getTime(),
        rangeEndMs: endRange.getTime(),
      };
    }
    case "monthly": {
      const year = base.getUTCFullYear();
      const monthIndex = base.getUTCMonth();
      const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

      const start = new Date(Date.UTC(year, monthIndex, 1));
      const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

      return {
        key,
        label: key,
        date: `${key}-01`,
        rangeStartMs: start.getTime(),
        rangeEndMs: end.getTime(),
      };
    }
    case "daily":
    default: {
      const start = new Date(base.getTime());
      const end = new Date(base.getTime());
      end.setUTCHours(23, 59, 59, 999);
      const iso = start.toISOString().slice(0, 10);
      return {
        key: iso,
        label: iso,
        date: iso,
        rangeStartMs: start.getTime(),
        rangeEndMs: end.getTime(),
      };
    }
  }
}

function aggregatePnLMetrics(items: AnyRecord[]): PnLMetrics {
  return {
    grossSales: sumBy(items, (item) => safeNumber(item.grossSales ?? item.totalSales ?? item.sales)),
    discounts: sumBy(items, (item) => safeNumber(item.discounts ?? item.totalDiscounts ?? 0)),
    refunds: sumBy(items, (item) => safeNumber(item.refunds ?? item.totalRefunds ?? 0)),
    rtoRevenueLost: sumBy(items, (item) => safeNumber(item.rtoRevenueLost ?? 0)),
    cancelledRevenue: sumBy(items, (item) => safeNumber(item.cancelledRevenue ?? 0)),
    grossRevenue: sumBy(items, (item) => {
      const provided = safeNumber(item.grossRevenue ?? 0);
      if (provided > 0) return provided;
      const baseRevenue = safeNumber(item.totalPrice ?? item.revenue ?? 0);
      const cancelled = safeNumber(item.cancelledRevenue ?? 0);
      return baseRevenue + cancelled;
    }),
    revenue: sumBy(items, (item) => safeNumber(item.revenue ?? item.netSales ?? item.totalPrice ?? 0)),
    cogs: sumBy(items, (item) => safeNumber(item.cogs ?? item.totalCostOfGoods ?? 0)),
    shippingCosts: sumBy(items, (item) => safeNumber(item.shippingCosts ?? item.totalShipping ?? 0)),
    transactionFees: sumBy(items, (item) => safeNumber(item.transactionFees ?? item.totalFees ?? 0)),
    handlingFees: sumBy(items, (item) => safeNumber(item.handlingFees ?? 0)),
    grossProfit: sumBy(items, (item) => safeNumber(item.grossProfit ?? 0)),
    taxesCollected: sumBy(items, (item) => safeNumber(item.taxesCollected ?? item.tax ?? 0)),
    customCosts: sumBy(items, (item) => safeNumber(item.customCosts ?? item.operatingCosts ?? 0)),
    totalAdSpend: sumBy(items, (item) => safeNumber(item.totalAdSpend ?? item.marketingCosts ?? 0)),
    netProfit: sumBy(items, (item) => safeNumber(item.netProfit ?? item.profit ?? 0)),
    netProfitMargin: 0,
  } satisfies PnLMetrics;
}

function finalisePnLMetrics(metrics: PnLMetrics): PnLMetrics {
  const netMargin = metrics.revenue > 0 ? (metrics.netProfit / metrics.revenue) * 100 : 0;
  return {
    ...metrics,
    netProfitMargin: netMargin,
  };
}

type CostComputationContext = {
  ordersCount: number;
  unitsSold: number;
  revenue: number;
  rangeStartMs: number;
  rangeEndMs: number;
};

function toCostMode(cost: AnyRecord): "fixed" | "perOrder" | "perUnit" | "percentageRevenue" | "timeBound" {
  // Schema has calculation and frequency as separate fields
  const freq = String(cost.frequency ?? "");
  const calc = String(cost.calculation ?? "fixed");

  // Check frequency first for per_order/per_unit patterns
  if (freq === "per_order") return "perOrder";
  if (freq === "per_unit" || freq === "per_item") return "perUnit";

  // Then check calculation for percentage and other modes
  if (calc === "percentage") return "percentageRevenue";
  if (calc === "per_unit") return "perUnit";

  // Default to fixed for monthly, yearly, one_time frequencies
  return "fixed";
}

function computeCostAmountForRange(cost: AnyRecord, ctx: CostComputationContext): number {
  // Schema uses 'value' field, not 'amount'
  const amount = safeNumber(cost.value ?? cost.amount ?? cost.total ?? 0);
  if (amount === 0) return 0;

  const mode = toCostMode(cost);
  const { overlapMs, windowMs } = computeCostOverlap(cost, ctx.rangeStartMs, ctx.rangeEndMs);
  if (overlapMs <= 0) {
    return 0;
  }

  const frequencyDuration = getFrequencyDurationMs(cost);

  switch (mode) {
    case "perOrder":
      return amount * ctx.ordersCount;
    case "perUnit":
      return amount * ctx.unitsSold;
    case "percentageRevenue":
      return ctx.revenue > 0 ? (amount / 100) * ctx.revenue : 0;
    case "timeBound": {
      if (windowMs && windowMs > 0) {
        return amount * (overlapMs / windowMs);
      }
      if (frequencyDuration) {
        return amount * (overlapMs / frequencyDuration);
      }
      return amount;
    }
    case "fixed":
    default:
      if (frequencyDuration) {
        return amount * (overlapMs / frequencyDuration);
      }
      return amount;
  }
}

function calculatePnLMetricsForRange({
  orders,
  costs,
  manualReturnRates,
  metaInsights,
  rangeStartMs,
  rangeEndMs,
}: {
  orders: AnyRecord[];
  costs: AnyRecord[];
  manualReturnRates: AnyRecord[];
  metaInsights: AnyRecord[];
  rangeStartMs: number;
  rangeEndMs: number;
}): { metrics: PnLMetrics; marketingCost: number } {
  const filteredOrders = orders.filter((order) => {
    const createdAt = safeNumber(order.shopifyCreatedAt ?? order.createdAt ?? order.processedAt ?? 0);
    if (!Number.isFinite(createdAt)) return false;
    if (Number.isFinite(rangeStartMs) && createdAt < rangeStartMs) return false;
    if (Number.isFinite(rangeEndMs) && createdAt > rangeEndMs) return false;
    return true;
  });

  const isCancelledOrder = (order: AnyRecord): boolean => {
    const candidates = [
      order.status,
      order.financialStatus,
      order.fulfillmentStatus,
      order.financial_status,
      order.fulfillment_status,
    ];

    return candidates.some((value) => {
      if (!value) return false;
      const normalized = String(value).toLowerCase();
      return normalized.includes("cancel") || normalized.includes("void") || normalized.includes("decline");
    });
  };

  const activeOrders: AnyRecord[] = [];
  for (const order of filteredOrders) {
    if (isCancelledOrder(order)) {
      continue;
    }
    activeOrders.push(order);
  }

  const grossSales = Math.max(
    sumBy(filteredOrders, (order) => safeNumber(order.subtotalPrice ?? order.totalSales ?? order.totalPrice ?? 0)),
    0,
  );
  const grossRevenue = Math.max(
    sumBy(filteredOrders, (order) => safeNumber(order.totalPrice ?? order.revenue ?? 0)),
    0,
  );
  const recognizedRevenue = Math.max(
    sumBy(activeOrders, (order) => safeNumber(order.totalPrice ?? order.revenue ?? 0)),
    0,
  );
  const cancelledRevenue = Math.max(grossRevenue - recognizedRevenue, 0);
  const discounts = Math.max(
    sumBy(filteredOrders, (order) => safeNumber(order.totalDiscounts ?? order.discounts ?? 0)),
    0,
  );
  const refunds = Math.max(
    sumBy(activeOrders, (order) => safeNumber(order.totalRefunded ?? order.totalRefunds ?? 0)),
    0,
  );
  const cogs = sumBy(activeOrders, (order) => safeNumber(order.totalCostOfGoods ?? order.cogs ?? 0));
  let shippingCosts = sumBy(activeOrders, (order) => safeNumber(order.shippingCosts ?? 0));
  let transactionFees = sumBy(activeOrders, (order) => safeNumber(order.totalFees ?? order.transactionFees ?? 0));
  const handlingFees = sumBy(activeOrders, (order) => safeNumber(order.handlingFees ?? 0));
  const taxesCollected = sumBy(activeOrders, (order) => safeNumber(order.taxesCollected ?? 0));

  const unitsSold = sumBy(activeOrders, (order) =>
    safeNumber(
      order.totalQuantity ??
        order.totalQuantityOrdered ??
        order.totalItems ??
        order.unitsSold ??
        0,
    ),
  );

  const context: CostComputationContext = {
    ordersCount: activeOrders.length,
    unitsSold,
    revenue: recognizedRevenue,
    rangeStartMs,
    rangeEndMs,
  };

  const shippingCostEntries = costs.filter((cost) => cost.type === "shipping");
  const paymentCostEntries = costs.filter((cost) => cost.type === "payment");
  const operationalCostEntries = costs.filter((cost) => {
    const type = String(cost.type ?? "");
    return type === "operational" || type === "custom";
  });

  // Use global costs primarily, fallback to order-level only if global costs are zero
  const globalShippingCosts = sumBy(shippingCostEntries, (cost) => computeCostAmountForRange(cost, context));
  shippingCosts = globalShippingCosts > 0 ? globalShippingCosts : shippingCosts;

  transactionFees += sumBy(paymentCostEntries, (cost) => computeCostAmountForRange(cost, context));
  const operationalCostsAmount = sumBy(operationalCostEntries, (cost) => computeCostAmountForRange(cost, context));

  const accountMetaInsights = filterAccountLevelMetaInsights(metaInsights);
  const metaSpend = sumBy(accountMetaInsights, (insight) => {
    if (!insight || typeof insight.date !== "string") return 0;
    const timestamp = Date.parse(`${insight.date}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp)) return 0;
    if (Number.isFinite(rangeStartMs) && timestamp < rangeStartMs) return 0;
    if (Number.isFinite(rangeEndMs) && timestamp > rangeEndMs) return 0;
    return safeNumber(insight.spend ?? 0);
  });

  const totalAdSpend = metaSpend;
  const customCosts = operationalCostsAmount;

  const manualRateWindow = Number.isFinite(rangeStartMs) && Number.isFinite(rangeEndMs)
    ? { start: rangeStartMs, end: rangeEndMs }
    : undefined;
  const manualReturnRatePercent = resolveManualReturnRate(manualReturnRates, manualRateWindow).ratePercent;
  const rtoRevenueLost = manualReturnRatePercent > 0
    ? Math.min(
        Math.max((recognizedRevenue * manualReturnRatePercent) / 100, 0),
        Math.max(recognizedRevenue, 0),
      )
    : 0;

  const costRetentionFactor = computeCostRetentionFactor({
    revenue: recognizedRevenue,
    refunds,
    rtoRevenueLost,
    manualReturnRatePercent,
  });

  const adjustedCogs = cogs * costRetentionFactor;
  const adjustedHandlingFees = handlingFees * costRetentionFactor;
  const adjustedTaxesCollected = taxesCollected * costRetentionFactor;

  const netRevenue = Math.max(recognizedRevenue - refunds - rtoRevenueLost, 0);
  const grossProfit = netRevenue - adjustedCogs;
  const netProfit = grossProfit - (
    shippingCosts +
    transactionFees +
    adjustedHandlingFees +
    adjustedTaxesCollected +
    customCosts +
    totalAdSpend
  );

  const metrics = finalisePnLMetrics({
    grossSales,
    discounts,
    refunds,
    rtoRevenueLost,
    cancelledRevenue,
    grossRevenue,
    revenue: netRevenue,
    cogs: adjustedCogs,
    shippingCosts,
    transactionFees,
    handlingFees: adjustedHandlingFees,
    grossProfit,
    taxesCollected: adjustedTaxesCollected,
    customCosts,
    totalAdSpend,
    netProfit,
    netProfitMargin: 0,
  });

  return {
    metrics,
    marketingCost: totalAdSpend,
  };
}

function buildPnLKPIs(total: PnLMetrics, marketingCost: number): PnLKPIMetrics {
  const netRevenue = total.revenue;
  const operatingExpenses = total.customCosts;
  const ebitda = total.netProfit + total.totalAdSpend + total.customCosts;
  const marketingROAS = marketingCost > 0 ? total.revenue / marketingCost : 0;
  const marketingROI = marketingCost > 0 ? (total.netProfit / marketingCost) * 100 : 0;

  return {
    grossSales: total.grossSales,
    grossRevenue: total.grossRevenue,
    discountsReturns: total.discounts + total.refunds,
    netRevenue,
    grossProfit: total.grossProfit,
    operatingExpenses,
    ebitda,
    netProfit: total.netProfit,
    netMargin: total.netProfitMargin,
    marketingCost: marketingCost,
    marketingROAS,
    marketingROI,
    changes: {
      grossSales: 0,
      grossRevenue: 0,
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
  } satisfies PnLKPIMetrics;
}

export function computePnLAnalytics(
  response: AnalyticsSourceResponse<any> | null | undefined,
  granularity: PnLGranularity,
): PnLAnalyticsResult {
  const emptyTotals = finalisePnLMetrics(aggregatePnLMetrics([]));
  if (!response) {
    return { metrics: null, periods: [], totals: emptyTotals } satisfies PnLAnalyticsResult;
  }

  const data = ensureDataset(response);
  if (!data) {
    return { metrics: null, periods: [], totals: emptyTotals } satisfies PnLAnalyticsResult;
  }

  const orders = (data.orders || []) as AnyRecord[];
  const costs = (data.globalCosts || []) as AnyRecord[];
  const manualReturnRates = (data.manualReturnRates || []) as AnyRecord[];
  const metaInsights = (data.metaInsights || []) as AnyRecord[];
  const buckets = new Map<
    string,
    {
      label: string;
      date: string;
      rangeStartMs: number;
      rangeEndMs: number;
      orders: AnyRecord[];
    }
  >();

  const ensureBucket = (dateValue: Date) => {
    const period = getPeriodKey(dateValue, granularity);
    const existing = buckets.get(period.key);
    if (existing) return existing;
    const bucket = {
      label: period.label,
      date: period.date,
      rangeStartMs: period.rangeStartMs,
      rangeEndMs: period.rangeEndMs,
      orders: [] as AnyRecord[],
    };
    buckets.set(period.key, bucket);
    return bucket;
  };

  for (const order of orders) {
    const createdAt = safeNumber(order.shopifyCreatedAt ?? order.createdAt ?? order.processedAt ?? Date.now());
    if (!Number.isFinite(createdAt)) continue;
    const bucket = ensureBucket(new Date(createdAt));
    bucket.orders.push(order);
  }

  for (const insight of metaInsights) {
    if (!insight || typeof insight.date !== "string") continue;
    const parsed = Date.parse(`${insight.date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed)) continue;
    ensureBucket(new Date(parsed));
  }

  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => a.rangeStartMs - b.rangeStartMs);

  const totalRangeStart = response.dateRange?.startDate
    ? Date.parse(`${response.dateRange.startDate}T00:00:00.000Z`)
    : Number.NEGATIVE_INFINITY;
  const totalRangeEnd = response.dateRange?.endDate
    ? Date.parse(`${response.dateRange.endDate}T23:59:59.999Z`)
    : Number.POSITIVE_INFINITY;

  const totalComputation = calculatePnLMetricsForRange({
    orders,
    costs,
    manualReturnRates,
    metaInsights,
    rangeStartMs: totalRangeStart,
    rangeEndMs: totalRangeEnd,
  });

  const periods: PnLTablePeriod[] = sortedBuckets.map((bucket) => {
    const { metrics } = calculatePnLMetricsForRange({
      orders: bucket.orders,
      costs,
      manualReturnRates,
      metaInsights,
      rangeStartMs: bucket.rangeStartMs,
      rangeEndMs: bucket.rangeEndMs,
    });

    return {
      label: bucket.label,
      date: bucket.date,
      metrics,
      growth: null,
    } satisfies PnLTablePeriod;
  });

  if (periods.length > 0) {
    periods.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    periods.push({
      label: "Total",
      date: response.dateRange?.endDate ?? new Date().toISOString().slice(0, 10),
      metrics: totalComputation.metrics,
      growth: null,
      isTotal: true,
    });
  }

  const kpis = buildPnLKPIs(totalComputation.metrics, totalComputation.metrics.totalAdSpend);

  const responseWithMeta = response as unknown as {
    meta?: {
      primaryCurrency?: unknown;
    };
  } | null | undefined;

  const primaryCurrency =
    typeof responseWithMeta?.meta?.primaryCurrency === "string"
      ? String(responseWithMeta.meta.primaryCurrency)
      : undefined;

  return {
    metrics: kpis,
    periods,
    totals: totalComputation.metrics,
    primaryCurrency,
  } satisfies PnLAnalyticsResult;
}

export function isDatasetEmpty(
  response: AnalyticsSourceResponse<any> | undefined | null,
  datasets?: readonly AnalyticsDatasetKey[],
): boolean {
  if (!response) return true;
  const data = ensureDataset(response);
  if (!data) return true;

  const keys = datasets ?? (Object.keys(data) as AnalyticsDatasetKey[]);
  return keys.every((key) => (data[key]?.length ?? 0) === 0);
}
