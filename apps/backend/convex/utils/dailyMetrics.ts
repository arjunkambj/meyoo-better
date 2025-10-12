import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  getRangeEndExclusiveMs,
  getRangeStartMs,
  type DateRange,
} from "./analyticsSource";
import type {
  OverviewComputation,
  MetricValue,
  OrdersOverviewMetrics,
  PnLAnalyticsResult,
  PnLGranularity,
  PnLKPIMetrics,
  PnLMetrics,
  PnLTablePeriod,
  PlatformMetrics,
  ChannelRevenueBreakdown,
} from "@repo/types";

const ZERO_PLATFORM_METRICS: PlatformMetrics = {
  shopifyConversionRate: 0,
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

type AnyRecord = Record<string, unknown>;

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function overlapsWindow(
  entryStart: number,
  entryEnd: number,
  window?: { start: number; end: number },
): boolean {
  if (!window) return true;
  const normalizedStart = Number.isFinite(entryStart)
    ? entryStart
    : Number.NEGATIVE_INFINITY;
  const normalizedEnd = Number.isFinite(entryEnd)
    ? entryEnd
    : Number.POSITIVE_INFINITY;
  return normalizedStart <= window.end && normalizedEnd >= window.start;
}

function resolveManualReturnRate(
  entries: AnyRecord[] | undefined,
  window?: { start: number; end: number },
): number {
  if (!entries?.length) {
    return 0;
  }

  const filtered = entries.filter((entry) => {
    const isActive = entry.isActive;
    const from = toNumber(entry.effectiveFrom ?? entry.createdAt ?? 0);
    const toRaw = entry.effectiveTo;
    const to = toRaw === undefined || toRaw === null ? Number.POSITIVE_INFINITY : toNumber(toRaw);

    if (isActive === false && !window) {
      return false;
    }

    return overlapsWindow(from, to, window);
  });

  if (filtered.length === 0) {
    return 0;
  }

  filtered.sort((a, b) => {
    const aTimestamp = toNumber(a.updatedAt ?? a.effectiveFrom ?? a.createdAt ?? 0);
    const bTimestamp = toNumber(b.updatedAt ?? b.effectiveFrom ?? b.createdAt ?? 0);
    return bTimestamp - aTimestamp;
  });

  const selected = filtered[0]!;
  const rawRate = toNumber(selected.ratePercent ?? selected.rate ?? selected.value ?? 0);
  return clampPercentage(rawRate);
}

function computeManualReturnRateForRange(
  entries: AnyRecord[] | undefined,
  range: DateRange,
): number {
  if (!entries?.length) {
    return 0;
  }

  const window = {
    start: getRangeStartMs(range),
    end: getRangeEndExclusiveMs(range) - 1,
  };

  return resolveManualReturnRate(entries, window);
}

type DailyMetricDoc = Doc<"dailyMetrics">;

const DAY_MS = 24 * 60 * 60 * 1000;

export type AggregatedDailyMetrics = {
  revenue: number;
  grossSales: number;
  discounts: number;
  refundsAmount: number;
  manualReturnRatePercent: number;
  rtoRevenueLost: number;
  orders: number;
  unitsSold: number;
  cogs: number;
  shippingCosts: number;
  transactionFees: number;
  handlingFees: number;
  taxesCollected: number;
  customCosts: number;
  marketingCost: number;
  blendedCtrSum: number;
  blendedCtrCount: number;
  paidCustomers: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatCustomers: number;
  prepaidOrders: number;
  codOrders: number;
  otherOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  sessions: number;
  visitors: number;
  conversions: number;
};

const EMPTY_AGGREGATES: AggregatedDailyMetrics = {
  revenue: 0,
  grossSales: 0,
  discounts: 0,
  refundsAmount: 0,
  manualReturnRatePercent: 0,
  rtoRevenueLost: 0,
  orders: 0,
  unitsSold: 0,
  cogs: 0,
  shippingCosts: 0,
  transactionFees: 0,
  handlingFees: 0,
  taxesCollected: 0,
  customCosts: 0,
  marketingCost: 0,
  blendedCtrSum: 0,
  blendedCtrCount: 0,
  paidCustomers: 0,
  totalCustomers: 0,
  newCustomers: 0,
  returningCustomers: 0,
  repeatCustomers: 0,
  prepaidOrders: 0,
  codOrders: 0,
  otherOrders: 0,
  cancelledOrders: 0,
  returnedOrders: 0,
  sessions: 0,
  visitors: 0,
  conversions: 0,
};


const EMPTY_PNL_METRICS: PnLMetrics = {
  grossSales: 0,
  discounts: 0,
  refunds: 0,
  rtoRevenueLost: 0,
  revenue: 0,
  cogs: 0,
  shippingCosts: 0,
  transactionFees: 0,
  handlingFees: 0,
  grossProfit: 0,
  taxesCollected: 0,
  customCosts: 0,
  totalAdSpend: 0,
  netProfit: 0,
  netProfitMargin: 0,
};

type OperationalCostDoc = Doc<"globalCosts">;

type CostComputationContext = {
  ordersCount: number;
  unitsSold: number;
  revenue: number;
  rangeStartMs: number;
  rangeEndMs: number;
};

function getCostFrequencyDurationMs(cost: OperationalCostDoc): number | null {
  const rawFrequency = String(cost.frequency ?? "").toLowerCase();

  switch (rawFrequency) {
    case "per_order":
    case "per_item":
      return null;
    case "daily":
    case "day":
      return DAY_MS;
    case "weekly":
    case "week":
      return 7 * DAY_MS;
    case "biweekly":
    case "fortnight":
    case "fortnightly":
      return 14 * DAY_MS;
    case "monthly":
    case "month":
      return 30 * DAY_MS;
    case "bimonthly":
      return 60 * DAY_MS;
    case "quarterly":
    case "quarter":
      return 91 * DAY_MS;
    case "semiannual":
    case "semiannually":
    case "biannual":
      return 182 * DAY_MS;
    case "yearly":
    case "year":
    case "annual":
    case "annually":
      return 365 * DAY_MS;
    default:
      return null;
  }
}

function toCostMode(cost: OperationalCostDoc):
  | "fixed"
  | "perOrder"
  | "perUnit"
  | "percentageRevenue"
  | "timeBound" {
  const frequency = String(cost.frequency ?? "").toLowerCase();
  const calculation = String(cost.calculation ?? "fixed").toLowerCase();

  if (frequency === "per_order") return "perOrder";
  if (frequency === "per_item" || frequency === "per_unit") return "perUnit";

  if (calculation === "percentage") return "percentageRevenue";
  if (calculation === "per_unit") return "perUnit";

  return "fixed";
}

function computeCostOverlapForRange(
  cost: OperationalCostDoc,
  rangeStartMs: number,
  rangeEndMs: number,
): { overlapMs: number; windowMs: number | null } {
  const rawStart = typeof cost.effectiveFrom === "number" ? cost.effectiveFrom : null;
  const rawEnd = typeof cost.effectiveTo === "number" ? cost.effectiveTo : null;

  const start = rawStart ?? rangeStartMs;
  const end = rawEnd ?? rangeEndMs;

  const overlapStart = Math.max(rangeStartMs, start);
  const overlapEnd = Math.min(rangeEndMs, end);
  const overlapMs = overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;

  if (rawStart !== null && rawEnd !== null && end > start) {
    return { overlapMs, windowMs: end - start };
  }

  return { overlapMs, windowMs: null };
}

function computeOperationalCostAmount(
  cost: OperationalCostDoc,
  ctx: CostComputationContext,
): number {
  const amount = toNumber(cost.value ?? (cost as Record<string, unknown>).amount ?? 0);
  if (amount === 0) {
    return 0;
  }

  const { overlapMs, windowMs } = computeCostOverlapForRange(cost, ctx.rangeStartMs, ctx.rangeEndMs);
  if (overlapMs <= 0) {
    return 0;
  }

  const mode = toCostMode(cost);
  const frequencyDuration = getCostFrequencyDurationMs(cost);

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
    default: {
      if (frequencyDuration) {
        return amount * (overlapMs / frequencyDuration);
      }
      return amount;
    }
  }
}

function applyOperationalCostsToAggregates(
  aggregates: AggregatedDailyMetrics,
  costs: OperationalCostDoc[],
  range: DateRange,
): AggregatedDailyMetrics {
  if (costs.length === 0) {
    return aggregates;
  }

  const rangeStartMs = getRangeStartMs(range);
  const rangeEndExclusiveMs = getRangeEndExclusiveMs(range);
  const normalizedStart = Number.isFinite(rangeStartMs) ? rangeStartMs : 0;
  const normalizedEnd = Number.isFinite(rangeEndExclusiveMs)
    ? rangeEndExclusiveMs - 1
    : normalizedStart;

  const context: CostComputationContext = {
    ordersCount: aggregates.orders,
    unitsSold: aggregates.unitsSold,
    revenue: aggregates.revenue,
    rangeStartMs: normalizedStart,
    rangeEndMs: normalizedEnd,
  };

  const totals = costs.reduce(
    (acc, cost) => {
      const amount = computeOperationalCostAmount(cost, context);
      if (amount <= 0) {
        return acc;
      }

      switch (cost.type) {
        case 'shipping':
          acc.shipping += amount;
          break;
        case 'payment':
          acc.payment += amount;
          break;
        case 'operational':
        default:
          acc.operational += amount;
          break;
      }

      return acc;
    },
    { shipping: 0, payment: 0, operational: 0 },
  );

  const shippingCosts = (() => {
    const base = aggregates.shippingCosts;
    const computed = totals.shipping;
    if (computed <= 0) {
      return base;
    }
    if (base <= 0) {
      return computed;
    }
    // Treat values within 5% (or $1) as effectively identical to avoid double counting
    const tolerance = Math.max(1, Math.min(Math.abs(base), Math.abs(computed)) * 0.05);
    return Math.abs(base - computed) <= tolerance ? base : Math.max(base, computed);
  })();

  return {
    ...aggregates,
    shippingCosts,
    transactionFees: aggregates.transactionFees + totals.payment,
    customCosts: aggregates.customCosts + totals.operational,
  } satisfies AggregatedDailyMetrics;
}

function applyManualReturnRateToAggregates(
  aggregates: AggregatedDailyMetrics,
  manualRatePercent: number,
): AggregatedDailyMetrics {
  const rate = clampPercentage(manualRatePercent);
  if (rate <= 0 || aggregates.revenue <= 0) {
    return {
      ...aggregates,
      manualReturnRatePercent: 0,
      rtoRevenueLost: 0,
    } satisfies AggregatedDailyMetrics;
  }

  const rtoRevenueLost = Math.min(
    (aggregates.revenue * rate) / 100,
    Math.max(aggregates.revenue, 0),
  );

  return {
    ...aggregates,
    manualReturnRatePercent: rate,
    rtoRevenueLost,
  } satisfies AggregatedDailyMetrics;
}

function applyManualReturnRateToPnLMetrics(
  metrics: PnLMetrics,
  grossRevenue: number,
  manualRatePercent: number,
): PnLMetrics {
  const baseRevenue = Math.max(grossRevenue, 0);
  const normalizedRate = clampPercentage(manualRatePercent) / 100;
  const refunds = Math.max(metrics.refunds ?? 0, 0);

  const rtoRevenueLost = baseRevenue > 0
    ? Math.min(baseRevenue * normalizedRate, baseRevenue)
    : 0;

  const refundRatio = baseRevenue > 0 ? Math.min(refunds / baseRevenue, 1) : 0;
  const rtoRatio = baseRevenue > 0 ? Math.min(rtoRevenueLost / baseRevenue, 1) : normalizedRate;
  const combinedReturnRatio = Math.min(refundRatio + rtoRatio, 1);
  const retentionFactor = Math.max(0, 1 - combinedReturnRatio);

  const originalCogs = metrics.cogs;
  const originalHandlingFees = metrics.handlingFees;
  const originalTaxesCollected = metrics.taxesCollected;
  const shippingCosts = metrics.shippingCosts;
  const transactionFees = metrics.transactionFees;
  const customCosts = metrics.customCosts;
  const adSpend = metrics.totalAdSpend;

  const adjustedCogs = originalCogs * retentionFactor;
  const adjustedHandlingFees = originalHandlingFees * retentionFactor;
  const adjustedTaxesCollected = originalTaxesCollected * retentionFactor;

  const netRevenue = Math.max(baseRevenue - refunds - rtoRevenueLost, 0);
  const grossProfit = netRevenue - adjustedCogs;
  const netProfit = grossProfit - (
    shippingCosts +
    transactionFees +
    adjustedHandlingFees +
    adjustedTaxesCollected +
    customCosts +
    adSpend
  );

  metrics.rtoRevenueLost = rtoRevenueLost;
  metrics.revenue = netRevenue;
  metrics.cogs = adjustedCogs;
  metrics.handlingFees = adjustedHandlingFees;
  metrics.taxesCollected = adjustedTaxesCollected;
  metrics.grossProfit = grossProfit;
  metrics.netProfit = netProfit;
  metrics.netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  return metrics;
}

export type CustomerOverviewMetrics = {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  avgLifetimeValue: number;
  avgOrderValue: number;
  avgOrdersPerCustomer: number;
  customerAcquisitionCost: number;
  churnRate: number;
  repeatPurchaseRate: number;
  periodCustomerCount: number;
  prepaidRate: number;
  abandonedRate: number;
  abandonedCartCustomers: number;
  changes: {
    totalCustomers: number;
    newCustomers: number;
    lifetimeValue: number;
  };
};

export interface DailyCustomerOverviewResult {
  metrics: CustomerOverviewMetrics;
  meta: Record<string, unknown>;
  hasFullCoverage: boolean;
}

type DailyMetricsFetchResult = {
  docs: DailyMetricDoc[];
  uniqueDates: string[];
  coverageStart: string;
  coverageEnd: string;
  availableDays: number;
  expectedDays: number | null;
  hasFullCoverage: boolean;
};

function inclusiveDaySpan(range: DateRange): number {
  const start = getRangeStartMs(range);
  const endExclusive = getRangeEndExclusiveMs(range);
  if (!Number.isFinite(start) || !Number.isFinite(endExclusive) || endExclusive <= start) {
    return 0;
  }
  const spanMs = endExclusive - start;
  return Math.max(1, Math.round(spanMs / DAY_MS));
}

function derivePreviousRange(range: DateRange): DateRange | null {
  const span = inclusiveDaySpan(range);
  if (span <= 0) {
    return null;
  }

  return {
    startDate: shiftDateString(range.startDate, -span),
    endDate: shiftDateString(range.startDate, -1),
  } satisfies DateRange;
}

function shiftDateString(date: string, deltaDays: number): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    return date;
  }
  const shifted = new Date(parsed);
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
  return shifted.toISOString().slice(0, 10);
}

function toIsoDateUtc(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function startOfWeekMondayUtc(date: Date): Date {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = base.getUTCDay() || 7;
  if (day !== 1) {
    base.setUTCDate(base.getUTCDate() - day + 1);
  }
  return base;
}

function deriveTableRangeForGranularity(range: DateRange, granularity: PnLGranularity): DateRange {
  const endMs = Date.parse(`${range.endDate}T00:00:00.000Z`);
  if (!Number.isFinite(endMs)) {
    return range;
  }

  const endDate = new Date(endMs);

  if (granularity === "weekly") {
    const endWeekStart = startOfWeekMondayUtc(endDate);
    const endWeekEnd = new Date(endWeekStart.getTime());
    endWeekEnd.setUTCDate(endWeekEnd.getUTCDate() + 6);
    const startWeekStart = new Date(endWeekStart.getTime());
    startWeekStart.setUTCDate(startWeekStart.getUTCDate() - 7 * (6 - 1));
    return {
      startDate: toIsoDateUtc(startWeekStart),
      endDate: toIsoDateUtc(endWeekEnd),
    };
  }

  if (granularity === "monthly") {
    const endMonthStart = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    const endMonthEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0));
    const startMonthStart = new Date(
      Date.UTC(endMonthStart.getUTCFullYear(), endMonthStart.getUTCMonth() - (3 - 1), 1),
    );
    return {
      startDate: toIsoDateUtc(startMonthStart),
      endDate: toIsoDateUtc(endMonthEnd),
    };
  }

  const startDate = new Date(endDate.getTime());
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  return {
    startDate: toIsoDateUtc(startDate),
    endDate: toIsoDateUtc(endDate),
  };
}

type PeriodDefinition = {
  key: string;
  label: string;
  date: string;
  rangeStartMs: number;
  rangeEndMs: number;
};

function buildPeriodDefinitionsForRange(
  range: DateRange,
  granularity: PnLGranularity,
): PeriodDefinition[] {
  const startMs = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const endMs = Date.parse(`${range.endDate}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return [];
  }

  const definitions: PeriodDefinition[] = [];
  const startDateObj = new Date(startMs);
  const endDateObj = new Date(endMs);

  if (granularity === "daily") {
    const cursor = new Date(startDateObj.getTime());
    while (cursor.getTime() <= endMs) {
      const period = getPnLPeriodKey(cursor, granularity);
      definitions.push(period);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return definitions;
  }

  if (granularity === "weekly") {
    const cursor = startOfWeekMondayUtc(new Date(startDateObj.getTime()));
    while (cursor.getTime() <= endMs) {
      const period = getPnLPeriodKey(cursor, granularity);
      definitions.push(period);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return definitions;
  }

  const monthCursor = new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(endDateObj.getUTCFullYear(), endDateObj.getUTCMonth(), 1));
  while (monthCursor.getTime() <= endMonth.getTime()) {
    const period = getPnLPeriodKey(monthCursor, granularity);
    definitions.push(period);
    monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
  }

  return definitions;
}

function calendarMonthBounds(date: Date): { startDate: string; endDate: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function previousCalendarMonth(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month - 1, 1));
}

function isCalendarMonthRange(range: DateRange): { baseDate: Date; bounds: { startDate: string; endDate: string } } | null {
  const startMs = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const endMs = Date.parse(`${range.endDate}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  const startDate = new Date(startMs);
  const endDate = new Date(endMs);

  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear() || startDate.getUTCMonth() !== endDate.getUTCMonth()) {
    return null;
  }

  const bounds = calendarMonthBounds(startDate);
  if (bounds.startDate !== range.startDate || bounds.endDate !== range.endDate) {
    return null;
  }

  return { baseDate: startDate, bounds };
}

async function computeCalendarMoMRevenueGrowth(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
  currentRevenue: number,
): Promise<number> {
  const calendarRange = isCalendarMonthRange(range);
  if (!calendarRange) {
    return 0;
  }

  const previousMonthDate = previousCalendarMonth(calendarRange.baseDate);
  const previousBounds = calendarMonthBounds(previousMonthDate);

  const previous = await fetchDailyMetricsDocs(ctx, organizationId, previousBounds);
  if (!previous) {
    return 0;
  }

  const previousAggregates = mergeDailyMetrics(previous.docs);
  const previousRevenue = previousAggregates.revenue;

  if (!(previousRevenue > 0)) {
    return currentRevenue > 0 ? 100 : 0;
  }

  const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  return Number.isFinite(growth) ? growth : 0;
}

async function fetchDailyMetricsDocs(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
): Promise<DailyMetricsFetchResult | null> {
  const docs = await ctx.db
    .query("dailyMetrics")
    .withIndex("by_organization_date", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("date", range.startDate)
        .lte("date", range.endDate),
    )
    .order("asc")
    .collect();

  if (docs.length === 0) {
    return null;
  }

  const uniqueDates = Array.from(new Set(docs.map((doc) => doc.date))).sort();
  const coverageStart = uniqueDates[0] ?? range.startDate;
  const coverageEnd = uniqueDates[uniqueDates.length - 1] ?? range.endDate;

  const rangeStartMs = getRangeStartMs(range);
  const rangeEndExclusiveMs = getRangeEndExclusiveMs(range);
  const coverageStartMs = Date.parse(`${coverageStart}T00:00:00.000Z`);
  const coverageEndMs = Date.parse(`${coverageEnd}T00:00:00.000Z`);

  const availableDays = uniqueDates.length;
  const expectedDays = Number.isFinite(rangeStartMs) && Number.isFinite(rangeEndExclusiveMs)
    ? Math.max(1, Math.round((rangeEndExclusiveMs - rangeStartMs) / DAY_MS))
    : null;

  const lastRangeDayStart = rangeEndExclusiveMs - DAY_MS;

  const hasFullCoverage =
    expectedDays !== null &&
    Number.isFinite(coverageStartMs) &&
    Number.isFinite(coverageEndMs) &&
    coverageStartMs <= rangeStartMs &&
    (coverageEndMs as number) >= lastRangeDayStart &&
    availableDays >= expectedDays;

  return {
    docs,
    uniqueDates,
    coverageStart,
    coverageEnd,
    availableDays,
    expectedDays,
    hasFullCoverage,
  } satisfies DailyMetricsFetchResult;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 0;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

type ChannelTotals = Map<string, { revenue: number; orders: number }>;

function aggregateChannelRevenueFromDocs(docs: DailyMetricDoc[]): ChannelTotals {
  const totals: ChannelTotals = new Map();

  for (const doc of docs) {
    const channels = Array.isArray(doc.channelRevenue) ? doc.channelRevenue : [];
    for (const entry of channels) {
      if (!entry || typeof entry !== "object") continue;
      const rawName = (entry as { name?: unknown }).name;
      const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
      if (!name) continue;

      const current = totals.get(name) ?? { revenue: 0, orders: 0 };
      current.revenue += toNumber((entry as { revenue?: unknown }).revenue);
      current.orders += toNumber((entry as { orders?: unknown }).orders);
      totals.set(name, current);
    }
  }

  return totals;
}

function buildChannelRevenueBreakdown(
  current: ChannelTotals,
  previous?: ChannelTotals | null,
): ChannelRevenueBreakdown | null {
  if (current.size === 0) {
    return null;
  }

  const previousTotals = previous ?? new Map();

  const channels = Array.from(current.entries())
    .map(([name, stats]) => {
      const previousStats = previousTotals.get(name);
      const previousRevenue = previousStats?.revenue ?? 0;
      return {
        name,
        revenue: stats.revenue,
        orders: stats.orders,
        change: percentageChange(stats.revenue, previousRevenue),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return { channels };
}

function mergeDailyMetrics(docs: DailyMetricDoc[]): AggregatedDailyMetrics {
  return docs.reduce<AggregatedDailyMetrics>((acc, doc) => {
    const revenue = toNumber(doc.totalRevenue);
    const discounts = toNumber(doc.totalDiscounts);
    const grossSales = toNumber(doc.grossSales);
    acc.revenue += revenue;
    acc.grossSales += grossSales > 0 ? grossSales : revenue + discounts;
    acc.discounts += discounts;
    acc.refundsAmount += 0;
    acc.orders += toNumber(doc.totalOrders);
    acc.unitsSold += toNumber(doc.unitsSold);
    acc.cogs += toNumber(doc.totalCogs);
    acc.shippingCosts += toNumber(doc.totalShippingCost);
    acc.transactionFees += toNumber(doc.totalTransactionFees);
    acc.handlingFees += toNumber(doc.totalHandlingFee);
    acc.taxesCollected += toNumber(doc.totalTaxes);
    acc.marketingCost += toNumber(doc.blendedMarketingCost);

    const ctr = toNumber(doc.blendedCtr);
    if (ctr > 0) {
      acc.blendedCtrSum += ctr;
      acc.blendedCtrCount += 1;
    }

    acc.paidCustomers += toNumber(doc.paidCustomers);
    acc.totalCustomers += toNumber(doc.totalCustomers);

    if (doc.customerBreakdown) {
      acc.newCustomers += toNumber(doc.customerBreakdown.newCustomers);
      acc.returningCustomers += toNumber(doc.customerBreakdown.returningCustomers);
      acc.repeatCustomers += toNumber(doc.customerBreakdown.repeatCustomers);
    }

    if (doc.paymentBreakdown) {
      acc.prepaidOrders += toNumber(doc.paymentBreakdown.prepaidOrders);
      acc.codOrders += toNumber(doc.paymentBreakdown.codOrders);
      acc.otherOrders += toNumber(doc.paymentBreakdown.otherOrders);
    }

    acc.cancelledOrders += toNumber(doc.cancelledOrders);
    acc.returnedOrders += toNumber(doc.returnedOrders);
    acc.sessions += toNumber(doc.sessions);
    acc.visitors += toNumber(doc.visitors);
    acc.conversions += toNumber(doc.conversions);

    return acc;
  }, { ...EMPTY_AGGREGATES });
}

function makeMetric(value: number, change = 0, previousValue?: number): MetricValue {
  const metric: MetricValue = { value, change };
  if (typeof previousValue === 'number' && Number.isFinite(previousValue)) {
    metric.previousValue = previousValue;
  }
  return metric;
}

function buildOverviewFromAggregates(
  aggregates: AggregatedDailyMetrics,
  previous: AggregatedDailyMetrics | null | undefined,
  metaClicks: number,
  previousMetaClicks: number,
): OverviewComputation {
  const prev = previous ?? null;

  const revenue = aggregates.revenue;
  const prevRevenue = prev?.revenue ?? 0;

  const grossSales = Math.max(aggregates.grossSales, revenue);
  const prevGrossSales = prev ? Math.max(prev.grossSales, prev.revenue) : prevRevenue;

  const discounts = aggregates.discounts;
  const prevDiscounts = prev?.discounts ?? 0;

  const refundsAmount = aggregates.refundsAmount;
  const prevRefundsAmount = prev?.refundsAmount ?? 0;
  const rtoRevenueLost = aggregates.rtoRevenueLost;
  const prevRtoRevenueLost = prev?.rtoRevenueLost ?? 0;

  const orders = aggregates.orders;
  const prevOrders = prev?.orders ?? 0;

  const unitsSold = aggregates.unitsSold;
  const prevUnitsSold = prev?.unitsSold ?? 0;

  const cogs = aggregates.cogs;
  const prevCogs = prev?.cogs ?? 0;

  const shippingCosts = aggregates.shippingCosts;
  const prevShippingCosts = prev?.shippingCosts ?? 0;

  const transactionFees = aggregates.transactionFees;
  const prevTransactionFees = prev?.transactionFees ?? 0;

  const handlingFees = aggregates.handlingFees;
  const prevHandlingFees = prev?.handlingFees ?? 0;

  const taxesCollected = aggregates.taxesCollected;
  const prevTaxesCollected = prev?.taxesCollected ?? 0;

  const customCosts = aggregates.customCosts;
  const prevCustomCosts = prev?.customCosts ?? 0;

  const marketingCost = aggregates.marketingCost;
  const prevMarketingCost = prev?.marketingCost ?? 0;

  const paidCustomers = aggregates.paidCustomers;
  const prevPaidCustomers = prev?.paidCustomers ?? 0;

  const totalCustomers = aggregates.totalCustomers;
  const prevTotalCustomers = prev?.totalCustomers ?? 0;

  const newCustomers = aggregates.newCustomers;
  const prevNewCustomers = prev?.newCustomers ?? 0;

  const returningCustomers = aggregates.returningCustomers;
  const prevReturningCustomers = prev?.returningCustomers ?? 0;

  const repeatCustomers = aggregates.repeatCustomers;
  const prevRepeatCustomers = prev?.repeatCustomers ?? 0;

  const returnedOrders = aggregates.returnedOrders;
  const prevReturnedOrders = prev?.returnedOrders ?? 0;

  const cancelledOrders = Math.max(aggregates.cancelledOrders, 0);
  const prevCancelledOrders = Math.max(prev?.cancelledOrders ?? 0, 0);
  const cancellationRate = orders > 0 ? (cancelledOrders / orders) * 100 : 0;
  const prevCancellationRate = prevOrders > 0 ? (prevCancelledOrders / prevOrders) * 100 : 0;

  const totalCostsWithoutAds =
    cogs + shippingCosts + transactionFees + handlingFees + taxesCollected + customCosts;
  const prevTotalCostsWithoutAds =
    prevCogs + prevShippingCosts + prevTransactionFees + prevHandlingFees + prevTaxesCollected + prevCustomCosts;

  const totalReturnImpact = refundsAmount + rtoRevenueLost;
  const prevTotalReturnImpact = prevRefundsAmount + prevRtoRevenueLost;
  const netProfit = revenue - totalCostsWithoutAds - marketingCost - totalReturnImpact;
  const prevNetProfit =
    prevRevenue - prevTotalCostsWithoutAds - prevMarketingCost - prevTotalReturnImpact;

  const operatingCosts = totalCostsWithoutAds + totalReturnImpact;
  const prevOperatingCosts = prevTotalCostsWithoutAds + prevTotalReturnImpact;
  const operatingProfit = revenue - operatingCosts;
  const prevOperatingProfit = prevRevenue - prevOperatingCosts;

  const grossProfit = revenue - cogs;
  const prevGrossProfit = prevRevenue - prevCogs;

  const contributionProfit =
    revenue - (cogs + shippingCosts + transactionFees + handlingFees + customCosts);
  const prevContributionProfit =
    prevRevenue - (prevCogs + prevShippingCosts + prevTransactionFees + prevHandlingFees + prevCustomCosts);

  const contributionMarginPercentage = revenue > 0 ? (contributionProfit / revenue) * 100 : 0;
  const prevContributionMarginPercentage =
    prevRevenue > 0 ? (prevContributionProfit / prevRevenue) * 100 : 0;

  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const prevProfitMargin = prevRevenue > 0 ? (prevNetProfit / prevRevenue) * 100 : 0;

  const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
  const prevOperatingMargin = prevRevenue > 0
    ? (prevOperatingProfit / prevRevenue) * 100
    : 0;

  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const prevGrossProfitMargin = prevRevenue > 0 ? (prevGrossProfit / prevRevenue) * 100 : 0;

  const averageOrderValue = orders > 0 ? revenue / orders : 0;
  const prevAverageOrderValue = prevOrders > 0 ? prevRevenue / prevOrders : 0;

  const averageOrderCost =
    orders > 0 ? (totalCostsWithoutAds + marketingCost) / orders : 0;
  const prevAverageOrderCost =
    prevOrders > 0 ? (prevTotalCostsWithoutAds + prevMarketingCost) / prevOrders : 0;

  const averageOrderProfit = orders > 0 ? netProfit / orders : 0;
  const prevAverageOrderProfit = prevOrders > 0 ? prevNetProfit / prevOrders : 0;

  const adSpendPerOrder = orders > 0 ? marketingCost / orders : 0;
  const prevAdSpendPerOrder = prevOrders > 0 ? prevMarketingCost / prevOrders : 0;

  const profitPerUnit = unitsSold > 0 ? netProfit / unitsSold : 0;
  const prevProfitPerUnit = prevUnitsSold > 0 ? prevNetProfit / prevUnitsSold : 0;

  const blendedRoas = marketingCost > 0 ? revenue / marketingCost : 0;
  const prevBlendedRoas = prevMarketingCost > 0 ? prevRevenue / prevMarketingCost : 0;

  const poas = marketingCost > 0 ? netProfit / marketingCost : 0;
  const prevPoas = prevMarketingCost > 0 ? prevNetProfit / prevMarketingCost : 0;


  const cogsPercentageOfGross = grossSales > 0 ? (cogs / grossSales) * 100 : 0;
  const prevCogsPercentageOfGross = prevGrossSales > 0 ? (prevCogs / prevGrossSales) * 100 : 0;

  const cogsPercentageOfNet = revenue > 0 ? (cogs / revenue) * 100 : 0;
  const prevCogsPercentageOfNet = prevRevenue > 0 ? (prevCogs / prevRevenue) * 100 : 0;

  const shippingPercentageOfNet = revenue > 0 ? (shippingCosts / revenue) * 100 : 0;
  const prevShippingPercentageOfNet = prevRevenue > 0 ? (prevShippingCosts / prevRevenue) * 100 : 0;

  const taxesPercentageOfRevenue = revenue > 0 ? (taxesCollected / revenue) * 100 : 0;
  const prevTaxesPercentageOfRevenue = prevRevenue > 0 ? (prevTaxesCollected / prevRevenue) * 100 : 0;

  const marketingPercentageOfGross = grossSales > 0 ? (marketingCost / grossSales) * 100 : 0;
  const prevMarketingPercentageOfGross =
    prevGrossSales > 0 ? (prevMarketingCost / prevGrossSales) * 100 : 0;

  const marketingPercentageOfNet = revenue > 0 ? (marketingCost / revenue) * 100 : 0;
  const prevMarketingPercentageOfNet =
    prevRevenue > 0 ? (prevMarketingCost / prevRevenue) * 100 : 0;

  const operatingCostPercentage = revenue > 0 ? (customCosts / revenue) * 100 : 0;
  const prevOperatingCostPercentage =
    prevRevenue > 0 ? (prevCustomCosts / prevRevenue) * 100 : 0;

  const customersCount = totalCustomers > 0 ? totalCustomers : paidCustomers;
  const prevCustomersCount = prevTotalCustomers > 0 ? prevTotalCustomers : prevPaidCustomers;

  const repeatCustomerBase = customersCount > 0 ? customersCount : paidCustomers;
  const prevRepeatCustomerBase = prevCustomersCount > 0 ? prevCustomersCount : prevPaidCustomers;

  const repeatCustomerRate = repeatCustomerBase > 0
    ? (repeatCustomers / repeatCustomerBase) * 100
    : 0;
  const prevRepeatCustomerRate = prevRepeatCustomerBase > 0
    ? (prevRepeatCustomers / prevRepeatCustomerBase) * 100
    : 0;

  const customerAcquisitionCost = orders > 0 ? marketingCost / orders : 0;
  const prevCustomerAcquisitionCost = prevOrders > 0
    ? prevMarketingCost / prevOrders
    : 0;

  const cacPercentageOfAOV = averageOrderValue > 0
    ? (customerAcquisitionCost / averageOrderValue) * 100
    : 0;
  const prevCacPercentageOfAOV = prevAverageOrderValue > 0
    ? (prevCustomerAcquisitionCost / prevAverageOrderValue) * 100
    : 0;

  const returnRate = orders > 0 ? (returnedOrders / orders) * 100 : 0;
  const prevReturnRate = prevOrders > 0 ? (prevReturnedOrders / prevOrders) * 100 : 0;

  const customerCountForLtv = customersCount > 0 ? customersCount : totalCustomers;
  const prevCustomerCountForLtv = prevCustomersCount > 0 ? prevCustomersCount : Math.max(prevTotalCustomers, 0);
  const lifetimeValue = customerCountForLtv > 0 ? revenue / customerCountForLtv : 0;
  const prevLifetimeValue = prevCustomerCountForLtv > 0 ? prevRevenue / prevCustomerCountForLtv : 0;
  const ltvToCac = customerAcquisitionCost > 0 ? lifetimeValue / customerAcquisitionCost : 0;
  const prevLtvToCac = prevCustomerAcquisitionCost > 0 ? prevLifetimeValue / prevCustomerAcquisitionCost : 0;

  const safeMetaClicks = Math.max(metaClicks, 0);
  const safePrevMetaClicks = Math.max(previousMetaClicks, 0);
  const blendedSessionConversionRate = safeMetaClicks > 0
    ? (orders / safeMetaClicks) * 100
    : 0;
  const prevBlendedSessionConversionRate = safePrevMetaClicks > 0
    ? (prevOrders / safePrevMetaClicks) * 100
    : 0;
  const uniqueVisitors = Math.max(aggregates.visitors, 0);

  const discountRate = revenue > 0 ? (discounts / revenue) * 100 : 0;
  const prevDiscountRate = prevRevenue > 0 ? (prevDiscounts / prevRevenue) * 100 : 0;

  const summary: OverviewComputation["summary"] = {
    revenue,
    revenueChange: percentageChange(revenue, prevRevenue),
    grossSales,
    grossSalesChange: percentageChange(grossSales, prevGrossSales),
    discounts,
    discountsChange: percentageChange(discounts, prevDiscounts),
    discountRate,
    discountRateChange: percentageChange(discountRate, prevDiscountRate),
    refunds: refundsAmount,
    refundsChange: percentageChange(refundsAmount, prevRefundsAmount),
    rtoRevenueLost,
    rtoRevenueLostChange: percentageChange(rtoRevenueLost, prevRtoRevenueLost),
    manualReturnRate: aggregates.manualReturnRatePercent,
    manualReturnRateChange: percentageChange(
      aggregates.manualReturnRatePercent,
      prev?.manualReturnRatePercent ?? 0,
    ),
    profit: netProfit,
    profitChange: percentageChange(netProfit, prevNetProfit),
    profitMargin,
    profitMarginChange: percentageChange(profitMargin, prevProfitMargin),
    grossProfit,
    grossProfitChange: percentageChange(grossProfit, prevGrossProfit),
    grossProfitMargin,
    grossProfitMarginChange: percentageChange(grossProfitMargin, prevGrossProfitMargin),
    contributionMargin: contributionProfit,
    contributionMarginChange: percentageChange(contributionProfit, prevContributionProfit),
    contributionMarginPercentage,
    contributionMarginPercentageChange: percentageChange(
      contributionMarginPercentage,
      prevContributionMarginPercentage,
    ),
    operatingMargin,
    operatingMarginChange: percentageChange(operatingMargin, prevOperatingMargin),
    blendedMarketingCost: marketingCost,
    blendedMarketingCostChange: percentageChange(marketingCost, prevMarketingCost),
    metaAdSpend: 0,
    metaAdSpendChange: 0,
    metaSpendPercentage: 0,
    metaSpendPercentageChange: 0,
    marketingPercentageOfGross,
    marketingPercentageOfGrossChange: percentageChange(
      marketingPercentageOfGross,
      prevMarketingPercentageOfGross,
    ),
    marketingPercentageOfNet,
    marketingPercentageOfNetChange: percentageChange(
      marketingPercentageOfNet,
      prevMarketingPercentageOfNet,
    ),
    metaROAS: 0,
    metaROASChange: 0,
    roas: blendedRoas,
    roasChange: percentageChange(blendedRoas, prevBlendedRoas),
    ncROAS: blendedRoas,
    ncROASChange: percentageChange(blendedRoas, prevBlendedRoas),
    poas,
    poasChange: percentageChange(poas, prevPoas),
    orders,
    ordersChange: percentageChange(orders, prevOrders),
    unitsSold,
    unitsSoldChange: percentageChange(unitsSold, prevUnitsSold),
    avgOrderValue: averageOrderValue,
    avgOrderValueChange: percentageChange(averageOrderValue, prevAverageOrderValue),
    avgOrderCost: averageOrderCost,
    avgOrderCostChange: percentageChange(averageOrderCost, prevAverageOrderCost),
    avgOrderProfit: averageOrderProfit,
    avgOrderProfitChange: percentageChange(averageOrderProfit, prevAverageOrderProfit),
    adSpendPerOrder,
    adSpendPerOrderChange: percentageChange(adSpendPerOrder, prevAdSpendPerOrder),
    profitPerOrder: averageOrderProfit,
    profitPerOrderChange: percentageChange(averageOrderProfit, prevAverageOrderProfit),
    profitPerUnit,
    profitPerUnitChange: percentageChange(profitPerUnit, prevProfitPerUnit),
    fulfillmentCostPerOrder: 0,
    fulfillmentCostPerOrderChange: 0,
    cogs,
    cogsChange: percentageChange(cogs, prevCogs),
    cogsPercentageOfGross,
    cogsPercentageOfGrossChange: percentageChange(
      cogsPercentageOfGross,
      prevCogsPercentageOfGross,
    ),
    cogsPercentageOfNet,
    cogsPercentageOfNetChange: percentageChange(
      cogsPercentageOfNet,
      prevCogsPercentageOfNet,
    ),
    shippingCosts,
    shippingCostsChange: percentageChange(shippingCosts, prevShippingCosts),
    shippingPercentageOfNet,
    shippingPercentageOfNetChange: percentageChange(
      shippingPercentageOfNet,
      prevShippingPercentageOfNet,
    ),
    transactionFees,
    transactionFeesChange: percentageChange(transactionFees, prevTransactionFees),
    handlingFees,
    handlingFeesChange: percentageChange(handlingFees, prevHandlingFees),
    taxesCollected,
    taxesCollectedChange: percentageChange(taxesCollected, prevTaxesCollected),
    taxesPercentageOfRevenue,
    taxesPercentageOfRevenueChange: percentageChange(
      taxesPercentageOfRevenue,
      prevTaxesPercentageOfRevenue,
    ),
    customCosts,
    customCostsChange: percentageChange(customCosts, prevCustomCosts),
    customCostsPercentage: operatingCostPercentage,
    customCostsPercentageChange: percentageChange(
      operatingCostPercentage,
      prevOperatingCostPercentage,
    ),
    customers: customersCount,
    customersChange: percentageChange(customersCount, prevCustomersCount),
    newCustomers,
    newCustomersChange: percentageChange(newCustomers, prevNewCustomers),
    returningCustomers,
    returningCustomersChange: percentageChange(returningCustomers, prevReturningCustomers),
    repeatCustomerRate,
    repeatCustomerRateChange: percentageChange(
      repeatCustomerRate,
      prevRepeatCustomerRate,
    ),
    customerAcquisitionCost,
    customerAcquisitionCostChange: percentageChange(
      customerAcquisitionCost,
      prevCustomerAcquisitionCost,
    ),
    cacPercentageOfAOV,
    cacPercentageOfAOVChange: percentageChange(
      cacPercentageOfAOV,
      prevCacPercentageOfAOV,
    ),
    abandonedCustomers: 0,
    abandonedCustomersChange: 0,
    abandonedRate: 0,
    abandonedRateChange: 0,
    returnRate,
    returnRateChange: percentageChange(returnRate, prevReturnRate),
    moMRevenueGrowth: 0,
    calendarMoMRevenueGrowth: 0,
  } satisfies OverviewComputation["summary"];

  const metrics: OverviewComputation["metrics"] = {
    revenue: makeMetric(revenue, percentageChange(revenue, prevRevenue), prevRevenue),
    profit: makeMetric(netProfit, percentageChange(netProfit, prevNetProfit), prevNetProfit),
    orders: makeMetric(orders, percentageChange(orders, prevOrders), prevOrders),
    avgOrderValue: makeMetric(
      averageOrderValue,
      percentageChange(averageOrderValue, prevAverageOrderValue),
      prevAverageOrderValue,
    ),
    roas: makeMetric(blendedRoas, percentageChange(blendedRoas, prevBlendedRoas), prevBlendedRoas),
    poas: makeMetric(poas, percentageChange(poas, prevPoas), prevPoas),
    contributionMargin: makeMetric(
      contributionProfit,
      percentageChange(contributionProfit, prevContributionProfit),
      prevContributionProfit,
    ),
    blendedMarketingCost: makeMetric(
      marketingCost,
      percentageChange(marketingCost, prevMarketingCost),
      prevMarketingCost,
    ),
    customerAcquisitionCost: makeMetric(
      customerAcquisitionCost,
      percentageChange(customerAcquisitionCost, prevCustomerAcquisitionCost),
      prevCustomerAcquisitionCost,
    ),
    cacPercentageOfAOV: makeMetric(
      cacPercentageOfAOV,
      percentageChange(cacPercentageOfAOV, prevCacPercentageOfAOV),
      prevCacPercentageOfAOV,
    ),
    profitPerOrder: makeMetric(
      averageOrderProfit,
      percentageChange(averageOrderProfit, prevAverageOrderProfit),
      prevAverageOrderProfit,
    ),
    rtoRevenueLost: makeMetric(
      rtoRevenueLost,
      percentageChange(rtoRevenueLost, prevRtoRevenueLost),
      prevRtoRevenueLost,
    ),
    manualReturnRate: makeMetric(
      aggregates.manualReturnRatePercent,
      percentageChange(aggregates.manualReturnRatePercent, prev?.manualReturnRatePercent ?? 0),
      prev?.manualReturnRatePercent ?? 0,
    ),
    cancelledOrderRate: makeMetric(
      cancellationRate,
      percentageChange(cancellationRate, prevCancellationRate),
      prevCancellationRate,
    ),
    ltvToCACRatio: makeMetric(
      ltvToCac,
      percentageChange(ltvToCac, prevLtvToCac),
      prevLtvToCac,
    ),
  } satisfies OverviewComputation["metrics"];

  return {
    summary,
    metrics,
    extras: {
      blendedSessionConversionRate,
      blendedSessionConversionRateChange: percentageChange(
        blendedSessionConversionRate,
        prevBlendedSessionConversionRate,
      ),
      uniqueVisitors,
    },
  } satisfies OverviewComputation;
}

function buildOrdersOverviewFromAggregates(
  aggregates: AggregatedDailyMetrics,
  previous?: AggregatedDailyMetrics | null,
): OrdersOverviewMetrics {
  const totalOrders = aggregates.orders;
  const totalRevenue = aggregates.revenue;
  const cogs = aggregates.cogs;
  const shippingCosts = aggregates.shippingCosts;
  const transactionFees = aggregates.transactionFees;
  const handlingFees = aggregates.handlingFees;
  const taxesCollected = aggregates.taxesCollected;
  const customCosts = aggregates.customCosts;
  const marketingCost = aggregates.marketingCost;
  const refundsAmount = aggregates.refundsAmount;
  const rtoRevenueLost = aggregates.rtoRevenueLost;
  const totalCosts =
    cogs +
    shippingCosts +
    transactionFees +
    handlingFees +
    taxesCollected +
    customCosts +
    marketingCost +
    refundsAmount +
    rtoRevenueLost;
  const netProfit = totalRevenue - totalCosts;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - cogs) / totalRevenue) * 100 : 0;
  const customerAcquisitionCost = totalOrders > 0
    ? marketingCost / totalOrders
    : 0;
  const fulfilledOrders = Math.max(0, totalOrders - aggregates.cancelledOrders);
  const fulfillmentRate = totalOrders > 0 ? (fulfilledOrders / totalOrders) * 100 : 0;
  const prepaidOrders = Math.max(aggregates.prepaidOrders, 0);
  const prepaidRate = totalOrders > 0 ? (prepaidOrders / totalOrders) * 100 : 0;
  const totalCustomers = Math.max(aggregates.totalCustomers, 0);
  const repeatCustomers = Math.max(aggregates.repeatCustomers, 0);
  const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
  const abandonedCustomers = Math.max(
    0,
    totalCustomers - Math.max(aggregates.paidCustomers, 0),
  );
  const rtoRevenueLoss = Math.max(rtoRevenueLost, 0);

  const prev = previous ?? null;
  const prevTotalOrders = prev?.orders ?? 0;
  const prevTotalRevenue = prev?.revenue ?? 0;
  const prevCogs = prev?.cogs ?? 0;
  const prevShippingCosts = prev?.shippingCosts ?? 0;
  const prevTransactionFees = prev?.transactionFees ?? 0;
  const prevHandlingFees = prev?.handlingFees ?? 0;
  const prevTaxesCollected = prev?.taxesCollected ?? 0;
  const prevCustomCosts = prev?.customCosts ?? 0;
  const prevMarketingCost = prev?.marketingCost ?? 0;
  const prevRefundsAmount = prev?.refundsAmount ?? 0;
  const prevRtoRevenueLost = prev?.rtoRevenueLost ?? 0;
  const prevTotalCosts =
    prevCogs +
    prevShippingCosts +
    prevTransactionFees +
    prevHandlingFees +
    prevTaxesCollected +
    prevCustomCosts +
    prevMarketingCost +
    prevRefundsAmount +
    prevRtoRevenueLost;
  const prevNetProfit = prevTotalRevenue - prevTotalCosts;
  const prevAvgOrderValue = prevTotalOrders > 0 ? prevTotalRevenue / prevTotalOrders : 0;
  const prevGrossMargin = prevTotalRevenue > 0
    ? ((prevTotalRevenue - prevCogs) / prevTotalRevenue) * 100
    : 0;
  const prevCustomerAcquisitionCost = prevTotalOrders > 0
    ? prevMarketingCost / prevTotalOrders
    : 0;
  const prevFulfilledOrders = prev ? Math.max(0, prev.orders - prev.cancelledOrders) : 0;
  const prevFulfillmentRate = prevTotalOrders > 0
    ? (prevFulfilledOrders / prevTotalOrders) * 100
    : 0;
  const prevPrepaidOrders = Math.max(prev?.prepaidOrders ?? 0, 0);
  const prevPrepaidRate = prevTotalOrders > 0
    ? (prevPrepaidOrders / prevTotalOrders) * 100
    : 0;
  const prevTotalCustomers = Math.max(prev?.totalCustomers ?? 0, 0);
  const prevRepeatCustomers = Math.max(prev?.repeatCustomers ?? 0, 0);
  const prevRepeatRate = prevTotalCustomers > 0
    ? (prevRepeatCustomers / prevTotalCustomers) * 100
    : 0;
  const prevAbandonedCustomers = Math.max(
    0,
    prevTotalCustomers - Math.max(prev?.paidCustomers ?? 0, 0),
  );

  return {
    totalOrders,
    cancelledOrders: aggregates.cancelledOrders || undefined,
    totalRevenue,
    totalCosts,
    netProfit,
    totalTax: taxesCollected,
    avgOrderValue,
    customerAcquisitionCost,
    grossMargin,
    fulfillmentRate,
    prepaidRate,
    repeatRate,
    rtoRevenueLoss,
    abandonedCustomers,
    changes: {
      totalOrders: percentageChange(totalOrders, prevTotalOrders),
      revenue: percentageChange(totalRevenue, prevTotalRevenue),
      netProfit: percentageChange(netProfit, prevNetProfit),
      avgOrderValue: percentageChange(avgOrderValue, prevAvgOrderValue),
      cac: percentageChange(customerAcquisitionCost, prevCustomerAcquisitionCost),
      margin: percentageChange(grossMargin, prevGrossMargin),
      fulfillmentRate: percentageChange(fulfillmentRate, prevFulfillmentRate),
      prepaidRate: percentageChange(prepaidRate, prevPrepaidRate),
      repeatRate: percentageChange(repeatRate, prevRepeatRate),
      rtoRevenueLoss: percentageChange(rtoRevenueLoss, prevRtoRevenueLost),
      abandonedCustomers: percentageChange(abandonedCustomers, prevAbandonedCustomers),
    },
  } satisfies OrdersOverviewMetrics;
}

function buildPlatformMetricsFromAggregates(aggregates: AggregatedDailyMetrics): PlatformMetrics {
  if (aggregates.blendedCtrCount === 0) {
    return ZERO_PLATFORM_METRICS;
  }

  const averageCtr = aggregates.blendedCtrSum / aggregates.blendedCtrCount;

  return {
    ...ZERO_PLATFORM_METRICS,
    blendedCTR: averageCtr,
  };
}

async function sumMetaUniqueClicksForRange(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
): Promise<number> {
  const records = await ctx.db
    .query("metaInsights")
    .withIndex("by_org_date", (q) =>
      q.eq("organizationId", organizationId).gte("date", range.startDate),
    )
    .filter((q) => q.lte(q.field("date"), range.endDate))
    .collect();

  let accountLevelSum = 0;
  let fallbackSum = 0;

  for (const record of records) {
    const clicks = toNumber(record.uniqueClicks ?? record.clicks);
    fallbackSum += clicks;
    if (String(record.entityType).toLowerCase() === "account") {
      accountLevelSum += clicks;
    }
  }

  return accountLevelSum > 0 ? accountLevelSum : fallbackSum;
}

function createEmptyPnLMetrics(): PnLMetrics {
  return { ...EMPTY_PNL_METRICS };
}

function finalizePnLMetrics(metrics: PnLMetrics): PnLMetrics {
  const netProfitMargin = metrics.revenue > 0 ? (metrics.netProfit / metrics.revenue) * 100 : 0;
  return {
    ...metrics,
    netProfitMargin,
  };
}

function aggregatedToPnLMetrics(aggregates: AggregatedDailyMetrics): PnLMetrics {
  const revenue = aggregates.revenue;
  const grossSales = Math.max(aggregates.grossSales, revenue + aggregates.discounts);
  const discounts = aggregates.discounts;
  const refunds = aggregates.refundsAmount;
  const rtoRevenueLost = aggregates.rtoRevenueLost;
  const cogs = aggregates.cogs;
  const shippingCosts = aggregates.shippingCosts;
  const transactionFees = aggregates.transactionFees;
  const handlingFees = aggregates.handlingFees;
  const taxesCollected = aggregates.taxesCollected;
  const customCosts = aggregates.customCosts;
  const marketingCost = aggregates.marketingCost;
  const manualRatePercent = aggregates.manualReturnRatePercent ?? 0;

  const baseRevenue = Math.max(revenue, 0);
  const normalizedRefunds = Math.max(refunds, 0);
  const normalizedRto = Math.max(rtoRevenueLost, 0);

  const refundRatio = baseRevenue > 0 ? Math.min(normalizedRefunds / baseRevenue, 1) : 0;
  const rtoRatio = baseRevenue > 0
    ? Math.min(normalizedRto / baseRevenue, 1)
    : clampPercentage(manualRatePercent) / 100;
  const combinedReturnRatio = Math.min(refundRatio + rtoRatio, 1);
  const retentionFactor = Math.max(0, 1 - combinedReturnRatio);

  const adjustedCogs = cogs * retentionFactor;
  const adjustedHandlingFees = handlingFees * retentionFactor;
  const adjustedTaxesCollected = taxesCollected * retentionFactor;

  const netRevenue = Math.max(baseRevenue - normalizedRefunds - normalizedRto, 0);
  const grossProfit = netRevenue - adjustedCogs;
  const netProfit = grossProfit - (
    shippingCosts +
    transactionFees +
    adjustedHandlingFees +
    adjustedTaxesCollected +
    customCosts +
    marketingCost
  );
  const netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  return {
    grossSales,
    discounts,
    refunds: normalizedRefunds,
    rtoRevenueLost: normalizedRto,
    revenue: netRevenue,
    cogs: adjustedCogs,
    shippingCosts,
    transactionFees,
    handlingFees: adjustedHandlingFees,
    grossProfit,
    taxesCollected: adjustedTaxesCollected,
    customCosts,
    totalAdSpend: marketingCost,
    netProfit,
    netProfitMargin,
  } satisfies PnLMetrics;
}

function accumulatePnLMetrics(target: PnLMetrics, addition: PnLMetrics): void {
  target.grossSales += addition.grossSales;
  target.discounts += addition.discounts;
  target.refunds += addition.refunds;
  target.rtoRevenueLost += addition.rtoRevenueLost;
  target.revenue += addition.revenue;
  target.cogs += addition.cogs;
  target.shippingCosts += addition.shippingCosts;
  target.transactionFees += addition.transactionFees;
  target.handlingFees += addition.handlingFees;
  target.grossProfit += addition.grossProfit;
  target.taxesCollected += addition.taxesCollected;
  target.customCosts += addition.customCosts;
  target.totalAdSpend += addition.totalAdSpend;
  target.netProfit += addition.netProfit;
  target.netProfitMargin = 0; // reset, finalize will compute actual margin
}

function metricsFromDailyMetricDoc(doc: DailyMetricDoc): PnLMetrics {
  const revenue = toNumber(doc.totalRevenue);
  const discounts = 'totalDiscounts' in doc ? toNumber((doc as Record<string, unknown>).totalDiscounts) : 0;
  const cogs = toNumber(doc.totalCogs);
  const shippingCosts = toNumber(doc.totalShippingCost);
  const transactionFees = toNumber(doc.totalTransactionFees);
  const handlingFees = toNumber(doc.totalHandlingFee);
  const taxesCollected = toNumber(doc.totalTaxes);
  const adSpend = toNumber(doc.blendedMarketingCost);

  const grossSales = revenue + discounts; // add back discounts captured in the snapshot
  const refunds = 0;
  const rtoRevenueLost = 0;
  const customCosts = 0;

  const netRevenue = revenue - refunds - rtoRevenueLost;
  const grossProfit = netRevenue - cogs;
  const netProfit = grossProfit - (shippingCosts + transactionFees + handlingFees + taxesCollected + customCosts + adSpend);
  const netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  return {
    grossSales,
    discounts,
    refunds,
    rtoRevenueLost,
    revenue: netRevenue,
    cogs,
    shippingCosts,
    transactionFees,
    handlingFees,
    grossProfit,
    taxesCollected,
    customCosts,
    totalAdSpend: adSpend,
    netProfit,
    netProfitMargin,
  } satisfies PnLMetrics;
}

function getPnLPeriodKey(date: Date, granularity: PnLGranularity) {
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

function buildPnLKpisFromTotals(total: PnLMetrics, previous?: PnLMetrics | null): PnLKPIMetrics {
  const marketingCost = total.totalAdSpend;
  const operatingExpenses = total.customCosts;
  const ebitda = total.netProfit + marketingCost + total.customCosts;
  const marketingROAS = marketingCost > 0 ? total.revenue / marketingCost : 0;
  const marketingROI = marketingCost > 0 ? (total.netProfit / marketingCost) * 100 : 0;

  return {
    grossSales: total.grossSales,
    discountsReturns: total.discounts + total.refunds,
    netRevenue: total.revenue,
    grossProfit: total.grossProfit,
    operatingExpenses,
    ebitda,
    netProfit: total.netProfit,
    netMargin: total.netProfitMargin,
    marketingCost,
    marketingROAS,
    marketingROI,
    changes: {
      grossSales: percentageChange(total.grossSales, previous?.grossSales ?? 0),
      discountsReturns: percentageChange(
        total.discounts + total.refunds,
        previous ? previous.discounts + previous.refunds : 0,
      ),
      netRevenue: percentageChange(total.revenue, previous?.revenue ?? 0),
      grossProfit: percentageChange(total.grossProfit, previous?.grossProfit ?? 0),
      operatingExpenses: percentageChange(operatingExpenses, previous?.customCosts ?? 0),
      ebitda: percentageChange(ebitda, previous ? previous.netProfit + previous.totalAdSpend + previous.customCosts : 0),
      netProfit: percentageChange(total.netProfit, previous?.netProfit ?? 0),
      netMargin: percentageChange(total.netProfitMargin, previous?.netProfitMargin ?? 0),
      marketingCost: percentageChange(marketingCost, previous?.totalAdSpend ?? 0),
      marketingROAS: percentageChange(marketingROAS, previous ? (previous.totalAdSpend > 0 ? previous.revenue / previous.totalAdSpend : 0) : 0),
      marketingROI: percentageChange(marketingROI, previous ? (previous.totalAdSpend > 0 ? (previous.netProfit / previous.totalAdSpend) * 100 : 0) : 0),
    },
  } satisfies PnLKPIMetrics;
}

export type DailyMetricsOverview = {
  overview: OverviewComputation;
  platformMetrics: PlatformMetrics;
  ordersOverview: OrdersOverviewMetrics;
  channelRevenue: ChannelRevenueBreakdown | null;
  aggregates: AggregatedDailyMetrics;
  meta: Record<string, unknown>;
  hasFullCoverage: boolean;
};

export async function loadOverviewFromDailyMetrics(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
): Promise<DailyMetricsOverview | null> {
  const fetched = await fetchDailyMetricsDocs(ctx, organizationId, range);
  if (!fetched) {
    return null;
  }

  const aggregates = mergeDailyMetrics(fetched.docs);
  const channelTotals = aggregateChannelRevenueFromDocs(fetched.docs);

  const activeOperationalCostDocs = await ctx.db
    .query("globalCosts")
    .withIndex("by_org_and_active", (q) =>
      q.eq("organizationId", organizationId).eq("isActive", true),
    )
    .collect();

  const aggregatesWithCosts = applyOperationalCostsToAggregates(
    aggregates,
    activeOperationalCostDocs,
    range,
  );

  const manualReturnRateDocs = (await ctx.db
    .query("manualReturnRates")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) as AnyRecord[];

  const manualRatePercent = computeManualReturnRateForRange(manualReturnRateDocs, range);
  const aggregatesAdjusted = applyManualReturnRateToAggregates(
    aggregatesWithCosts,
    manualRatePercent,
  );

  const metaClicks = await sumMetaUniqueClicksForRange(ctx, organizationId, range);

  const previousRange = derivePreviousRange(range);
  let previousAggregatesWithCosts: AggregatedDailyMetrics | null = null;
  let previousMetaClicks = 0;
  let previousChannelTotals: ChannelTotals | null = null;

  if (previousRange) {
    const previousFetched = await fetchDailyMetricsDocs(ctx, organizationId, previousRange);
    if (previousFetched) {
      const merged = mergeDailyMetrics(previousFetched.docs);
      previousAggregatesWithCosts = applyOperationalCostsToAggregates(
        merged,
        activeOperationalCostDocs,
        previousRange,
      );
      const previousRatePercent = computeManualReturnRateForRange(
        manualReturnRateDocs,
        previousRange,
      );
      previousAggregatesWithCosts = applyManualReturnRateToAggregates(
        previousAggregatesWithCosts,
        previousRatePercent,
      );
      previousChannelTotals = aggregateChannelRevenueFromDocs(previousFetched.docs);
    }
    previousMetaClicks = await sumMetaUniqueClicksForRange(ctx, organizationId, previousRange);
  }

  const overview = buildOverviewFromAggregates(
    aggregatesAdjusted,
    previousAggregatesWithCosts,
    metaClicks,
    previousMetaClicks,
  );
  const platformMetrics = buildPlatformMetricsFromAggregates(aggregatesAdjusted);
  const ordersOverview = buildOrdersOverviewFromAggregates(
    aggregatesAdjusted,
    previousAggregatesWithCosts,
  );

  const customerOverview = await loadCustomerOverviewFromDailyMetrics(
    ctx,
    organizationId,
    range,
  );
  const channelRevenue = buildChannelRevenueBreakdown(channelTotals, previousChannelTotals);

  let previousCustomerMetrics: CustomerOverviewMetrics | null = null;
  if (previousRange) {
    const previousCustomerOverview = await loadCustomerOverviewFromDailyMetrics(
      ctx,
      organizationId,
      previousRange,
    );
    previousCustomerMetrics = previousCustomerOverview?.metrics ?? null;
  }

  if (customerOverview?.metrics && overview?.summary) {
    const currentCustomerMetrics = customerOverview.metrics;
    const summary = overview.summary;

    summary.customers = currentCustomerMetrics.periodCustomerCount;
    summary.newCustomers = currentCustomerMetrics.newCustomers;
    summary.returningCustomers = currentCustomerMetrics.returningCustomers;
    summary.repeatCustomerRate = currentCustomerMetrics.repeatPurchaseRate;
    summary.customerAcquisitionCost = currentCustomerMetrics.customerAcquisitionCost;
    summary.abandonedCustomers = currentCustomerMetrics.abandonedCartCustomers;
    summary.abandonedRate = currentCustomerMetrics.abandonedRate;

    const previousMetrics = previousCustomerMetrics;
    summary.customersChange = previousMetrics
      ? percentageChange(
          currentCustomerMetrics.periodCustomerCount,
          previousMetrics.periodCustomerCount,
        )
      : summary.customersChange;
    summary.newCustomersChange = previousMetrics
      ? percentageChange(currentCustomerMetrics.newCustomers, previousMetrics.newCustomers)
      : summary.newCustomersChange;
    summary.returningCustomersChange = previousMetrics
      ? percentageChange(currentCustomerMetrics.returningCustomers, previousMetrics.returningCustomers)
      : summary.returningCustomersChange;
    summary.repeatCustomerRateChange = previousMetrics
      ? percentageChange(currentCustomerMetrics.repeatPurchaseRate, previousMetrics.repeatPurchaseRate)
      : summary.repeatCustomerRateChange;
    summary.customerAcquisitionCostChange = previousMetrics
      ? percentageChange(
          currentCustomerMetrics.customerAcquisitionCost,
          previousMetrics.customerAcquisitionCost,
        )
      : summary.customerAcquisitionCostChange;
    summary.abandonedCustomersChange = previousMetrics
      ? percentageChange(
          currentCustomerMetrics.abandonedCartCustomers,
          previousMetrics.abandonedCartCustomers,
        )
      : summary.abandonedCustomersChange;
    summary.abandonedRateChange = previousMetrics
      ? percentageChange(currentCustomerMetrics.abandonedRate, previousMetrics.abandonedRate)
      : summary.abandonedRateChange;

    overview.metrics = overview.metrics ?? {};
    const existingCustomerAcquisitionMetric = overview.metrics.customerAcquisitionCost;
    const existingPrepaidRateMetric = overview.metrics.prepaidRate as MetricValue | undefined;
    overview.metrics.customerAcquisitionCost = {
      value: currentCustomerMetrics.customerAcquisitionCost,
      change: previousMetrics
        ? percentageChange(
            currentCustomerMetrics.customerAcquisitionCost,
            previousMetrics.customerAcquisitionCost,
          )
        : overview.metrics.customerAcquisitionCost?.change ?? 0,
      previousValue: previousMetrics
        ? previousMetrics.customerAcquisitionCost
        : existingCustomerAcquisitionMetric?.previousValue,
    } satisfies MetricValue;
    overview.metrics.prepaidRate = {
      value: currentCustomerMetrics.prepaidRate,
      change: previousMetrics
        ? percentageChange(currentCustomerMetrics.prepaidRate, previousMetrics.prepaidRate)
        : overview.metrics.prepaidRate?.change ?? 0,
      previousValue: previousMetrics
        ? previousMetrics.prepaidRate
        : existingPrepaidRateMetric?.previousValue,
    } satisfies MetricValue;
  }

  const calendarMoMRevenueGrowth = await computeCalendarMoMRevenueGrowth(
    ctx,
    organizationId,
    range,
    aggregatesAdjusted.revenue,
  );
  overview.summary.calendarMoMRevenueGrowth = calendarMoMRevenueGrowth;

  const derivedAbandoned = Math.max(
    0,
    aggregatesAdjusted.totalCustomers - aggregatesAdjusted.paidCustomers,
  );

  const meta: Record<string, unknown> = {
    source: "dailyMetrics",
    days: fetched.availableDays,
    coverage: {
      start: fetched.coverageStart,
      end: fetched.coverageEnd,
      requested: {
        start: range.startDate,
        end: range.endDate,
      },
    },
    paymentBreakdown: {
      prepaidOrders: aggregatesAdjusted.prepaidOrders,
      codOrders: aggregatesAdjusted.codOrders,
      otherOrders: aggregatesAdjusted.otherOrders,
    },
    customerBreakdown: {
      paidCustomers: aggregatesAdjusted.paidCustomers,
      totalCustomers: aggregatesAdjusted.totalCustomers,
      newCustomers: aggregatesAdjusted.newCustomers,
      returningCustomers: aggregatesAdjusted.returningCustomers,
      repeatCustomers: aggregatesAdjusted.repeatCustomers,
      abandonedCustomers: derivedAbandoned,
    },
    manualReturnRate: aggregatesAdjusted.manualReturnRatePercent,
    rtoRevenueLost: aggregatesAdjusted.rtoRevenueLost,
  };

  if (previousRange) {
    meta.previousRange = previousRange;
  }

  if (previousAggregatesWithCosts) {
    meta.previousAggregates = {
      revenue: previousAggregatesWithCosts.revenue,
      orders: previousAggregatesWithCosts.orders,
      marketingCost: previousAggregatesWithCosts.marketingCost,
      totalCustomers: previousAggregatesWithCosts.totalCustomers,
      newCustomers: previousAggregatesWithCosts.newCustomers,
    } satisfies Record<string, unknown>;
  }

  return {
    overview,
    platformMetrics,
    ordersOverview,
    channelRevenue,
    aggregates: aggregatesAdjusted,
    meta,
    hasFullCoverage: fetched.hasFullCoverage,
  };
}

function percentageChange(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) {
    if (current > 0) {
      return 100;
    }
    if (current < 0) {
      return -100;
    }
    return 0;
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number.isFinite(change) ? change : 0;
}

function buildCustomerOverviewMetrics(
  aggregates: AggregatedDailyMetrics,
): CustomerOverviewMetrics {
  const totalCustomers = Math.max(aggregates.totalCustomers, 0);
  const paidCustomers = Math.max(aggregates.paidCustomers, 0);
  const orders = Math.max(aggregates.orders, 0);
  const revenue = Math.max(aggregates.revenue, 0);
  const marketingCost = Math.max(aggregates.marketingCost, 0);
  const newCustomers = Math.max(aggregates.newCustomers, 0);
  const returningCustomers = Math.max(aggregates.returningCustomers, 0);
  const repeatCustomers = Math.max(aggregates.repeatCustomers, 0);
  const prepaidOrders = Math.max(aggregates.prepaidOrders, 0);

  const activeCustomers = paidCustomers;
  const churnedCustomers = Math.max(totalCustomers - activeCustomers, 0);
  const avgLifetimeValue = totalCustomers > 0 ? revenue / totalCustomers : 0;
  const avgOrderValue = orders > 0 ? revenue / orders : 0;
  const avgOrdersPerCustomer = totalCustomers > 0 ? orders / totalCustomers : 0;
  const customerAcquisitionCost = orders > 0 ? marketingCost / orders : 0;
  const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
  const periodCustomerCount = activeCustomers;
  const repeatPurchaseRate = periodCustomerCount > 0
    ? (repeatCustomers / periodCustomerCount) * 100
    : 0;
  const prepaidRate = orders > 0 ? (prepaidOrders / orders) * 100 : 0;
  const abandonedCartCustomers = Math.max(totalCustomers - activeCustomers, 0);
  const abandonedRate = periodCustomerCount > 0
    ? (abandonedCartCustomers / periodCustomerCount) * 100
    : 0;

  return {
    totalCustomers,
    newCustomers,
    returningCustomers,
    activeCustomers,
    churnedCustomers,
    avgLifetimeValue,
    avgOrderValue,
    avgOrdersPerCustomer,
    customerAcquisitionCost,
    churnRate,
    repeatPurchaseRate,
    periodCustomerCount,
    prepaidRate,
    abandonedRate,
    abandonedCartCustomers,
    changes: {
      totalCustomers: 0,
      newCustomers: 0,
      lifetimeValue: 0,
    },
  } satisfies CustomerOverviewMetrics;
}

function applyCustomerOverviewChanges(
  metrics: CustomerOverviewMetrics,
  previousAggregates: AggregatedDailyMetrics | null,
): void {
  if (!previousAggregates) {
    return;
  }

  const prevTotalCustomers = Math.max(previousAggregates.totalCustomers, 0);
  const prevNewCustomers = Math.max(previousAggregates.newCustomers, 0);
  const prevRevenue = Math.max(previousAggregates.revenue, 0);

  metrics.changes.totalCustomers = percentageChange(
    metrics.totalCustomers,
    prevTotalCustomers,
  );

  metrics.changes.newCustomers = percentageChange(
    metrics.newCustomers,
    prevNewCustomers,
  );

  const prevAvgLifetimeValue = prevTotalCustomers > 0 ? prevRevenue / prevTotalCustomers : 0;
  metrics.changes.lifetimeValue = percentageChange(
    metrics.avgLifetimeValue,
    prevAvgLifetimeValue,
  );
}

export async function loadCustomerOverviewFromDailyMetrics(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
): Promise<DailyCustomerOverviewResult | null> {
  const fetched = await fetchDailyMetricsDocs(ctx, organizationId, range);
  if (!fetched) {
    return null;
  }

  const aggregates = mergeDailyMetrics(fetched.docs);
  const lastDoc = fetched.docs[fetched.docs.length - 1] ?? null;
  const totalCustomersSnapshot = lastDoc ? toNumber(lastDoc.totalCustomers) : 0;
  const adjustedAggregates: AggregatedDailyMetrics = {
    ...aggregates,
    totalCustomers:
      totalCustomersSnapshot > 0 ? totalCustomersSnapshot : aggregates.totalCustomers,
  };

  const organizationCustomers = await ctx.db
    .query("shopifyCustomers")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const rangeStartMs = getRangeStartMs(range);
  const currentRangeEndExclusive = getRangeEndExclusiveMs(range);

  const ordersInRange = await ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization_and_created", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("shopifyCreatedAt", rangeStartMs)
        .lt("shopifyCreatedAt", currentRangeEndExclusive),
    )
    .filter((q) => q.neq(q.field("financialStatus"), "cancelled"))
    .collect();

  const orderCustomerIds = new Set<string>();
  const periodOrdersPerCustomer = new Map<string, number>();
  let prepaidOrdersInRange = 0;
  const inferPrepaid = (order: Doc<"shopifyOrders">): boolean => {
    const rawOrder = order as AnyRecord;
    const status = String(order.financialStatus ?? rawOrder.financial_status ?? "").toLowerCase();
    const gateway = String((rawOrder.gateway ?? rawOrder.paymentGateway ?? "") as string).toLowerCase();

    if (status.includes("cod") || gateway.includes("cod")) {
      return false;
    }
    if (gateway.includes("cash_on_delivery") || gateway.includes("cash-on-delivery")) {
      return false;
    }
    if (status.includes("pending") || status.includes("authorized") || status.includes("unpaid")) {
      return false;
    }
    const prepaidIndicators = ["paid", "partially_paid", "refunded", "partially_refunded", "captured"] as const;
    if (prepaidIndicators.some((token) => status.includes(token))) {
      return true;
    }
    if (gateway.includes("manual")) {
      return false;
    }
    return true;
  };

  for (const order of ordersInRange) {
    if (order.customerId) {
      const id = String(order.customerId);
      orderCustomerIds.add(id);
      periodOrdersPerCustomer.set(id, (periodOrdersPerCustomer.get(id) ?? 0) + 1);
    }

    if (inferPrepaid(order)) {
      prepaidOrdersInRange += 1;
    }
  }

  const customersCreatedInRange = organizationCustomers.filter((customer) => {
    const createdAt = toNumber(customer.shopifyCreatedAt);
    return createdAt >= rangeStartMs && createdAt < currentRangeEndExclusive;
  });

  const abandonedCustomersInRange = customersCreatedInRange.reduce((total, customer) => {
    const id = String(customer._id);
    return orderCustomerIds.has(id) ? total : total + 1;
  }, 0);

  const countCustomersBefore = (exclusiveMs: number | null): number => {
    if (exclusiveMs === null) {
      return organizationCustomers.length;
    }
    return organizationCustomers.reduce((total, customer) => {
      const createdAt = toNumber(customer.shopifyCreatedAt);
      return createdAt < exclusiveMs ? total + 1 : total;
    }, 0);
  };

  const actualTotalCustomers = countCustomersBefore(currentRangeEndExclusive);
  const totalCustomerUniverse = Math.max(actualTotalCustomers, adjustedAggregates.totalCustomers);
  const aggregatesWithCustomers: AggregatedDailyMetrics = {
    ...adjustedAggregates,
    totalCustomers: totalCustomerUniverse,
  };
  const metrics = buildCustomerOverviewMetrics(aggregatesWithCustomers);
  const activeCustomerCount = orderCustomerIds.size;
  metrics.activeCustomers = activeCustomerCount;
  metrics.periodCustomerCount = activeCustomerCount;

  const customersById = new Map<string, typeof organizationCustomers[number]>();
  for (const customer of organizationCustomers) {
    customersById.set(String(customer._id), customer);
  }

  let newCustomersInRange = 0;
  let repeatCustomersInRange = 0;
  for (const [customerId, periodOrders] of periodOrdersPerCustomer.entries()) {
    const customerDoc = customersById.get(customerId);
    const rawCustomer = customerDoc as AnyRecord | undefined;
    const lifetimeOrders = toNumber(
      customerDoc?.ordersCount ?? rawCustomer?.orders_count ?? periodOrders,
    );
    if (periodOrders > 1) {
      repeatCustomersInRange += 1;
    }
    if (periodOrders > 0 && lifetimeOrders === periodOrders) {
      newCustomersInRange += 1;
    }
  }

  metrics.newCustomers = newCustomersInRange;
  metrics.returningCustomers = Math.max(activeCustomerCount - newCustomersInRange, 0);
  const repeatRate = activeCustomerCount > 0
    ? (repeatCustomersInRange / activeCustomerCount) * 100
    : 0;
  metrics.repeatPurchaseRate = repeatRate;
  metrics.periodCustomerCount = activeCustomerCount;
  metrics.abandonedCartCustomers = Math.max(abandonedCustomersInRange, 0);
  metrics.abandonedRate = activeCustomerCount > 0
    ? (metrics.abandonedCartCustomers / activeCustomerCount) * 100
    : 0;
  metrics.totalCustomers = activeCustomerCount;
  metrics.prepaidRate = ordersInRange.length > 0
    ? (prepaidOrdersInRange / ordersInRange.length) * 100
    : 0;
  metrics.churnedCustomers = Math.max(totalCustomerUniverse - activeCustomerCount, 0);
  metrics.churnRate = totalCustomerUniverse > 0
    ? (metrics.churnedCustomers / totalCustomerUniverse) * 100
    : 0;

  const span = inclusiveDaySpan(range);
  const previousRange = span > 0
    ? {
        startDate: shiftDateString(range.startDate, -span),
        endDate: shiftDateString(range.startDate, -1),
      }
    : null;

  let previousAggregates: AggregatedDailyMetrics | null = null;
  if (previousRange) {
    const previousFetched = await fetchDailyMetricsDocs(ctx, organizationId, previousRange);
    if (previousFetched) {
      const merged = mergeDailyMetrics(previousFetched.docs);
      const prevLast = previousFetched.docs[previousFetched.docs.length - 1] ?? null;
      const prevTotalSnapshot = prevLast ? toNumber(prevLast.totalCustomers) : 0;
      const previousRangeEndExclusive = getRangeEndExclusiveMs(previousRange);
      const previousActualTotal = countCustomersBefore(previousRangeEndExclusive);
      previousAggregates = {
        ...merged,
        totalCustomers: Math.max(
          previousActualTotal,
          prevTotalSnapshot > 0 ? prevTotalSnapshot : merged.totalCustomers,
        ),
      } satisfies AggregatedDailyMetrics;
    }
  }

  applyCustomerOverviewChanges(metrics, previousAggregates);

  const meta: Record<string, unknown> = {
    source: "dailyMetrics",
    strategy: "dailyMetrics",
    days: fetched.availableDays,
    coverage: {
      start: fetched.coverageStart,
      end: fetched.coverageEnd,
      requested: {
        start: range.startDate,
        end: range.endDate,
      },
    },
    hasFullCoverage: fetched.hasFullCoverage,
    previousRange,
    aggregates: {
        revenue: aggregatesWithCustomers.revenue,
        orders: aggregatesWithCustomers.orders,
        marketingCost: aggregatesWithCustomers.marketingCost,
        totalCustomers: aggregatesWithCustomers.totalCustomers,
        paidCustomers: aggregatesWithCustomers.paidCustomers,
        newCustomers: aggregatesWithCustomers.newCustomers,
        returningCustomers: aggregatesWithCustomers.returningCustomers,
        repeatCustomers: aggregatesWithCustomers.repeatCustomers,
        prepaidOrders: aggregatesWithCustomers.prepaidOrders,
        codOrders: aggregatesWithCustomers.codOrders,
        otherOrders: aggregatesWithCustomers.otherOrders,
    },
  } satisfies Record<string, unknown>;

  if (previousAggregates) {
    meta.previousAggregates = {
      revenue: previousAggregates.revenue,
      orders: previousAggregates.orders,
      totalCustomers: previousAggregates.totalCustomers,
      newCustomers: previousAggregates.newCustomers,
    } satisfies Record<string, unknown>;
  }

  return {
    metrics,
    meta,
    hasFullCoverage: fetched.hasFullCoverage,
  } satisfies DailyCustomerOverviewResult;
}

export interface DailyPnLMeta {
  hasData: boolean;
  coverage: {
    firstAvailable: string | null;
    lastAvailable: string | null;
    requested: DateRange;
    tableRange: DateRange;
  };
  availableDays: number;
  selectedAvailableDays: number;
  selectedHasData: boolean;
  expectedDays: number | null;
  hasFullCoverage: boolean | null;
  operatingCosts: number;
  marketingCost: number;
  tableRange: DateRange;
}

export async function loadPnLAnalyticsFromDailyMetrics(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
  granularity: PnLGranularity,
): Promise<{ result: PnLAnalyticsResult; meta: DailyPnLMeta }> {
  const tableRange = deriveTableRangeForGranularity(range, granularity);

  const docs = await ctx.db
    .query("dailyMetrics")
    .withIndex("by_organization_date", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("date", tableRange.startDate)
        .lte("date", tableRange.endDate),
    )
    .order("asc")
    .collect();

  const periodDefinitions = buildPeriodDefinitionsForRange(tableRange, granularity);
  const tableUniqueDates = periodDefinitions.map((definition) => definition.date);

  const selectedDocs = docs.filter(
    (doc) => doc.date >= range.startDate && doc.date <= range.endDate,
  );
  const selectedUniqueDates = Array.from(
    new Set(selectedDocs.map((doc) => doc.date)),
  );

  const coverageStart = selectedUniqueDates[0] ?? null;
  const coverageEnd = selectedUniqueDates[selectedUniqueDates.length - 1] ?? null;

  const selectedRangeStartMs = getRangeStartMs(range);
  const selectedRangeEndExclusiveMs = getRangeEndExclusiveMs(range);
  const selectedRangeEndMs = selectedRangeEndExclusiveMs - 1;
  const tableRangeStartMs = getRangeStartMs(tableRange);
  const tableRangeEndExclusiveMs = getRangeEndExclusiveMs(tableRange);
  const tableRangeEndMs = tableRangeEndExclusiveMs - 1;
  const coverageStartMs = coverageStart ? Date.parse(`${coverageStart}T00:00:00.000Z`) : null;
  const coverageEndMs = coverageEnd ? Date.parse(`${coverageEnd}T00:00:00.000Z`) : null;

  const expectedDays = Number.isFinite(selectedRangeStartMs) && Number.isFinite(selectedRangeEndExclusiveMs)
    ? Math.max(1, Math.round((selectedRangeEndExclusiveMs - selectedRangeStartMs) / DAY_MS))
    : null;

  const hasFullCoverage = expectedDays !== null && coverageStartMs !== null && coverageEndMs !== null
    && Number.isFinite(selectedRangeStartMs) && Number.isFinite(selectedRangeEndExclusiveMs)
    ? coverageStartMs <= selectedRangeStartMs! &&
      coverageEndMs >= (selectedRangeEndExclusiveMs! - DAY_MS) &&
      selectedUniqueDates.length >= expectedDays
    : null;

  const selectedHasData = selectedDocs.length > 0;
  const tableTotals = createEmptyPnLMetrics();
  const selectedTotals = createEmptyPnLMetrics();
  let totalOrdersCount = 0;
  let totalUnitsSold = 0;
  let totalRevenue = 0;
  let selectedRevenue = 0;
  const buckets = new Map<
    string,
    {
      label: string;
      date: string;
      rangeStartMs: number;
      rangeEndMs: number;
      metrics: PnLMetrics;
      ordersCount: number;
      unitsSold: number;
      revenue: number;
      overlapsSelected: boolean;
    }
  >();

  for (const definition of periodDefinitions) {
    const overlapsSelected =
      Number.isFinite(selectedRangeStartMs) && Number.isFinite(selectedRangeEndMs)
        ? definition.rangeEndMs >= selectedRangeStartMs! &&
          definition.rangeStartMs <= selectedRangeEndMs!
        : false;

    buckets.set(definition.key, {
      label: definition.label,
      date: definition.date,
      rangeStartMs: definition.rangeStartMs,
      rangeEndMs: definition.rangeEndMs,
      metrics: createEmptyPnLMetrics(),
      ordersCount: 0,
      unitsSold: 0,
      revenue: 0,
      overlapsSelected,
    });
  }

  for (const doc of docs) {
    const metrics = metricsFromDailyMetricDoc(doc);
    accumulatePnLMetrics(tableTotals, metrics);
    const isSelected = doc.date >= range.startDate && doc.date <= range.endDate;
    if (isSelected) {
      accumulatePnLMetrics(selectedTotals, metrics);
    }

    const docOrders = toNumber(doc.totalOrders);
    const docUnits = toNumber(doc.unitsSold);
    const docRevenue = toNumber(doc.totalRevenue);
    totalOrdersCount += docOrders;
    totalUnitsSold += docUnits;
    totalRevenue += docRevenue;
    if (isSelected) {
      selectedRevenue += docRevenue;
    }

    const parsed = Date.parse(`${doc.date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    const period = getPnLPeriodKey(new Date(parsed), granularity);
    let bucket = buckets.get(period.key);
    if (!bucket) {
      const overlapsSelected =
        Number.isFinite(selectedRangeStartMs) && Number.isFinite(selectedRangeEndMs)
          ? period.rangeEndMs >= selectedRangeStartMs! &&
            period.rangeStartMs <= selectedRangeEndMs!
          : false;
      bucket = {
        label: period.label,
        date: period.date,
        rangeStartMs: period.rangeStartMs,
        rangeEndMs: period.rangeEndMs,
        metrics: createEmptyPnLMetrics(),
        ordersCount: 0,
        unitsSold: 0,
        revenue: 0,
        overlapsSelected,
      };
      buckets.set(period.key, bucket);
    }

    accumulatePnLMetrics(bucket.metrics, metrics);
    bucket.ordersCount += docOrders;
    bucket.unitsSold += docUnits;
    bucket.revenue += docRevenue;
  }

  const hasData = docs.length > 0;
  const hasAnyPeriod = periodDefinitions.length > 0;

  let totalOperationalCost = 0;
  let selectedOperationalCost = 0;
  let costDocs: OperationalCostDoc[] = [];
  if (hasData) {
    const organizationCosts = await ctx.db
      .query("globalCosts")
      .withIndex("by_org_and_type", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    costDocs = organizationCosts.filter((cost) => {
      const costType = String(cost.type ?? "");
      return costType === "operational" || costType === "custom";
    });

    if (costDocs.length > 0) {
      const bucketEntries = Array.from(buckets.entries());
      const bucketAllocations = new Map<string, number>();
      for (const [key] of bucketEntries) {
        bucketAllocations.set(key, 0);
      }

      const contextEndMs = Number.isFinite(tableRangeEndMs)
        ? tableRangeEndMs
        : tableRangeEndExclusiveMs - 1;
      const totalsContext: CostComputationContext = {
        ordersCount: totalOrdersCount,
        unitsSold: totalUnitsSold,
        revenue: totalRevenue,
        rangeStartMs: Number.isFinite(tableRangeStartMs) ? tableRangeStartMs : 0,
        rangeEndMs: Number.isFinite(contextEndMs) ? contextEndMs : tableRangeEndExclusiveMs - 1,
      };

      for (const cost of costDocs) {
        const totalAmount = computeOperationalCostAmount(cost, totalsContext);
        if (totalAmount === 0) {
          continue;
        }

        const mode = toCostMode(cost);
        let totalWeight = 0;
        const weights = new Map<string, number>();

        for (const [key, bucket] of bucketEntries) {
          const { overlapMs } = computeCostOverlapForRange(cost, bucket.rangeStartMs, bucket.rangeEndMs);
          if (overlapMs <= 0) {
            weights.set(key, 0);
            continue;
          }

          let weight = 0;
          switch (mode) {
            case "perOrder":
              weight = bucket.ordersCount;
              break;
            case "perUnit":
              weight = bucket.unitsSold;
              break;
            case "percentageRevenue":
              weight = bucket.revenue;
              break;
            default:
              weight = overlapMs;
              break;
          }

          if (weight <= 0) {
            weight = overlapMs;
          }

          weights.set(key, weight);
          totalWeight += weight;
        }

        if (totalWeight <= 0) {
          continue;
        }

        let allocated = 0;
        let fallbackKey: string | null = null;

        for (const [key, weight] of weights.entries()) {
          if (weight <= 0) {
            continue;
          }
          const share = totalAmount * (weight / totalWeight);
          bucketAllocations.set(key, (bucketAllocations.get(key) ?? 0) + share);
          allocated += share;
          fallbackKey = key;
        }

        const remainder = totalAmount - allocated;
        if (fallbackKey && Math.abs(remainder) > 1e-6) {
          bucketAllocations.set(
            fallbackKey,
            (bucketAllocations.get(fallbackKey) ?? 0) + remainder,
          );
        }
      }

      for (const [key, bucket] of bucketEntries) {
        const allocation = bucketAllocations.get(key) ?? 0;
        if (allocation === 0) {
          continue;
        }
        bucket.metrics.customCosts += allocation;
        bucket.metrics.netProfit -= allocation;
        totalOperationalCost += allocation;
        if (bucket.overlapsSelected) {
          selectedOperationalCost += allocation;
        }
      }

      if (totalOperationalCost !== 0) {
        tableTotals.customCosts += totalOperationalCost;
        tableTotals.netProfit -= totalOperationalCost;
      }
      if (selectedOperationalCost !== 0) {
        selectedTotals.customCosts += selectedOperationalCost;
        selectedTotals.netProfit -= selectedOperationalCost;
      }
    }
  }

  const manualReturnRateDocs = (await ctx.db
    .query("manualReturnRates")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) as AnyRecord[];

  const totalsManualRate = resolveManualReturnRate(manualReturnRateDocs, {
    start: Number.isFinite(tableRangeStartMs) ? tableRangeStartMs : 0,
    end: Number.isFinite(tableRangeEndMs) ? tableRangeEndMs : tableRangeEndExclusiveMs - 1,
  });
  applyManualReturnRateToPnLMetrics(tableTotals, totalRevenue, totalsManualRate);

  const selectedManualRate = resolveManualReturnRate(manualReturnRateDocs, {
    start: Number.isFinite(selectedRangeStartMs) ? selectedRangeStartMs : 0,
    end: Number.isFinite(selectedRangeEndMs) ? selectedRangeEndMs : selectedRangeEndExclusiveMs - 1,
  });
  applyManualReturnRateToPnLMetrics(selectedTotals, selectedRevenue, selectedManualRate);

  for (const bucket of buckets.values()) {
    const bucketManualRate = resolveManualReturnRate(manualReturnRateDocs, {
      start: bucket.rangeStartMs,
      end: bucket.rangeEndMs,
    });
    applyManualReturnRateToPnLMetrics(bucket.metrics, bucket.revenue, bucketManualRate);
  }

  const tableTotalsFinal = finalizePnLMetrics(tableTotals);
  const selectedTotalsFinal = finalizePnLMetrics(selectedTotals);

  let previousTotalsFinal: PnLMetrics | null = null;
  const previousRange = derivePreviousRange(range);
  if (previousRange) {
    const previousFetched = await fetchDailyMetricsDocs(ctx, organizationId, previousRange);
    if (previousFetched) {
      const previousAggregates = mergeDailyMetrics(previousFetched.docs);
      const previousWithCosts = costDocs.length > 0
        ? applyOperationalCostsToAggregates(previousAggregates, costDocs, previousRange)
        : previousAggregates;
      const previousRatePercent = computeManualReturnRateForRange(
        manualReturnRateDocs,
        previousRange,
      );
      const previousAdjusted = applyManualReturnRateToAggregates(
        previousWithCosts,
        previousRatePercent,
      );
      previousTotalsFinal = aggregatedToPnLMetrics(previousAdjusted);
    }
  }

  const periods: PnLTablePeriod[] = hasAnyPeriod
    ? Array.from(buckets.values())
        .sort((a, b) => a.rangeStartMs - b.rangeStartMs)
        .map((bucket) => ({
          label: bucket.label,
          date: bucket.date,
          metrics: finalizePnLMetrics(bucket.metrics),
          growth: null,
        }))
    : [];

  if (periods.length > 0) {
    for (let index = 0; index < periods.length; index += 1) {
      const current = periods[index]!;
      const previous = index > 0 ? periods[index - 1]! : null;
      current.growth = previous
        ? {
            revenue: percentageChange(current.metrics.revenue, previous.metrics.revenue),
            netProfit: percentageChange(current.metrics.netProfit, previous.metrics.netProfit),
          }
        : null;
    }
  }

  if (hasAnyPeriod && periods.length > 0) {
    periods.push({
      label: "Total",
      date: tableRange.endDate,
      metrics: tableTotalsFinal,
      growth: null,
      isTotal: true,
    });
  }

  const metrics = buildPnLKpisFromTotals(selectedTotalsFinal, previousTotalsFinal);

  return {
    result: {
      metrics,
      periods,
      totals: selectedTotalsFinal,
      tableRange,
    },
    meta: {
      hasData,
      coverage: {
        firstAvailable: coverageStart,
        lastAvailable: coverageEnd,
        requested: range,
        tableRange,
      },
      availableDays: tableUniqueDates.length,
      selectedAvailableDays: selectedUniqueDates.length,
      selectedHasData,
      expectedDays,
      hasFullCoverage,
      operatingCosts: selectedTotalsFinal.customCosts,
      marketingCost: selectedTotalsFinal.totalAdSpend,
      tableRange,
    },
  };
}
