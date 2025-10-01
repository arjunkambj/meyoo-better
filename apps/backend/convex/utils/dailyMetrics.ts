import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { DateRange } from "./analyticsSource";
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

type DailyMetricDoc = Doc<"dailyMetrics">;

type AggregatedDailyMetrics = {
  revenue: number;
  grossSales: number;
  discounts: number;
  refundsAmount: number;
  orders: number;
  unitsSold: number;
  cogs: number;
  shippingCosts: number;
  transactionFees: number;
  handlingFees: number;
  taxesCollected: number;
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
};

const EMPTY_AGGREGATES: AggregatedDailyMetrics = {
  revenue: 0,
  grossSales: 0,
  discounts: 0,
  refundsAmount: 0,
  orders: 0,
  unitsSold: 0,
  cogs: 0,
  shippingCosts: 0,
  transactionFees: 0,
  handlingFees: 0,
  taxesCollected: 0,
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
};


const EMPTY_PNL_METRICS: PnLMetrics = {
  grossSales: 0,
  discounts: 0,
  refunds: 0,
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

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function mergeDailyMetrics(docs: DailyMetricDoc[]): AggregatedDailyMetrics {
  return docs.reduce<AggregatedDailyMetrics>((acc, doc) => {
    acc.revenue += toNumber(doc.totalRevenue);
    acc.grossSales += toNumber(doc.totalRevenue);
    acc.discounts += 0;
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

    return acc;
  }, { ...EMPTY_AGGREGATES });
}

function makeMetric(value: number, change = 0): MetricValue {
  return { value, change };
}

function buildOverviewFromAggregates(aggregates: AggregatedDailyMetrics): OverviewComputation {
  const revenue = aggregates.revenue;
  const grossSales = Math.max(aggregates.grossSales, revenue);
  const discounts = aggregates.discounts;
  const refundsAmount = aggregates.refundsAmount;
  const orders = aggregates.orders;
  const unitsSold = aggregates.unitsSold;
  const cogs = aggregates.cogs;
  const shippingCosts = aggregates.shippingCosts;
  const transactionFees = aggregates.transactionFees;
  const handlingFees = aggregates.handlingFees;
  const taxesCollected = aggregates.taxesCollected;
  const marketingCost = aggregates.marketingCost;
  const paidCustomers = aggregates.paidCustomers;
  const totalCustomers = aggregates.totalCustomers;
  const newCustomers = aggregates.newCustomers;
  const returningCustomers = aggregates.returningCustomers;
  const repeatCustomers = aggregates.repeatCustomers;
  const returnedOrders = aggregates.returnedOrders;

  const totalCostsWithoutAds = cogs + shippingCosts + transactionFees + handlingFees + taxesCollected;
  const netProfit = revenue - totalCostsWithoutAds - marketingCost - refundsAmount;
  const grossProfit = revenue - cogs;
  const contributionProfit = revenue - (cogs + shippingCosts + transactionFees + handlingFees);
  const contributionMarginPercentage = revenue > 0 ? (contributionProfit / revenue) * 100 : 0;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const averageOrderValue = orders > 0 ? revenue / orders : 0;
  const averageOrderCost = orders > 0 ? (totalCostsWithoutAds + marketingCost) / orders : 0;
  const averageOrderProfit = orders > 0 ? netProfit / orders : 0;
  const adSpendPerOrder = orders > 0 ? marketingCost / orders : 0;
  const profitPerUnit = unitsSold > 0 ? netProfit / unitsSold : 0;
  const blendedRoas = marketingCost > 0 ? revenue / marketingCost : 0;
  const poas = marketingCost > 0 ? netProfit / marketingCost : 0;

  const cogsPercentageOfGross = grossSales > 0 ? (cogs / grossSales) * 100 : 0;
  const cogsPercentageOfNet = revenue > 0 ? (cogs / revenue) * 100 : 0;
  const shippingPercentageOfNet = revenue > 0 ? (shippingCosts / revenue) * 100 : 0;
  const taxesPercentageOfRevenue = revenue > 0 ? (taxesCollected / revenue) * 100 : 0;
  const marketingPercentageOfGross = grossSales > 0 ? (marketingCost / grossSales) * 100 : 0;
  const marketingPercentageOfNet = revenue > 0 ? (marketingCost / revenue) * 100 : 0;

  const customersCount = totalCustomers > 0 ? totalCustomers : paidCustomers;
  const repeatCustomerBase = customersCount > 0 ? customersCount : paidCustomers;
  const repeatCustomerRate = repeatCustomerBase > 0 ? (repeatCustomers / repeatCustomerBase) * 100 : 0;
  const customerAcquisitionCost = newCustomers > 0 ? marketingCost / newCustomers : 0;
  const cacPercentageOfAOV = averageOrderValue > 0 ? (customerAcquisitionCost / averageOrderValue) * 100 : 0;
  const returnRate = orders > 0 ? (returnedOrders / orders) * 100 : 0;

  const summary: OverviewComputation["summary"] = {
    revenue,
    revenueChange: 0,
    grossSales,
    grossSalesChange: 0,
    discounts,
    discountsChange: 0,
    discountRate: revenue > 0 ? (discounts / revenue) * 100 : 0,
    discountRateChange: 0,
    refunds: refundsAmount,
    refundsChange: 0,
    profit: netProfit,
    profitChange: 0,
    profitMargin,
    profitMarginChange: 0,
    grossProfit,
    grossProfitChange: 0,
    grossProfitMargin,
    grossProfitMarginChange: 0,
    contributionMargin: contributionProfit,
    contributionMarginChange: 0,
    contributionMarginPercentage,
    contributionMarginPercentageChange: 0,
    operatingMargin: profitMargin,
    operatingMarginChange: 0,
    blendedMarketingCost: marketingCost,
    blendedMarketingCostChange: 0,
    metaAdSpend: 0,
    metaAdSpendChange: 0,
    googleAdSpend: 0,
    googleAdSpendChange: 0,
    metaSpendPercentage: 0,
    metaSpendPercentageChange: 0,
    marketingPercentageOfGross,
    marketingPercentageOfGrossChange: 0,
    marketingPercentageOfNet,
    marketingPercentageOfNetChange: 0,
    metaROAS: 0,
    metaROASChange: 0,
    roas: blendedRoas,
    roasChange: 0,
    ncROAS: blendedRoas,
    ncROASChange: 0,
    poas,
    poasChange: 0,
    orders,
    ordersChange: 0,
    unitsSold,
    unitsSoldChange: 0,
    avgOrderValue: averageOrderValue,
    avgOrderValueChange: 0,
    avgOrderCost: averageOrderCost,
    avgOrderCostChange: 0,
    avgOrderProfit: averageOrderProfit,
    avgOrderProfitChange: 0,
    adSpendPerOrder,
    adSpendPerOrderChange: 0,
    profitPerOrder: averageOrderProfit,
    profitPerOrderChange: 0,
    profitPerUnit,
    profitPerUnitChange: 0,
    cogs,
    cogsChange: 0,
    cogsPercentageOfGross,
    cogsPercentageOfGrossChange: 0,
    cogsPercentageOfNet,
    cogsPercentageOfNetChange: 0,
    shippingCosts,
    shippingCostsChange: 0,
    shippingPercentageOfNet,
    shippingPercentageOfNetChange: 0,
    transactionFees,
    transactionFeesChange: 0,
    handlingFees,
    handlingFeesChange: 0,
    taxesCollected,
    taxesCollectedChange: 0,
    taxesPercentageOfRevenue,
    taxesPercentageOfRevenueChange: 0,
    customCosts: 0,
    customCostsChange: 0,
    customCostsPercentage: 0,
    customCostsPercentageChange: 0,
    customers: customersCount,
    customersChange: 0,
    newCustomers,
    newCustomersChange: 0,
    returningCustomers,
    returningCustomersChange: 0,
    repeatCustomerRate,
    repeatCustomerRateChange: 0,
    customerAcquisitionCost,
    customerAcquisitionCostChange: 0,
    cacPercentageOfAOV,
    cacPercentageOfAOVChange: 0,
    returnRate,
    returnRateChange: 0,
    moMRevenueGrowth: 0,
    calendarMoMRevenueGrowth: 0,
  };

  const contributionMarginMetric = makeMetric(contributionProfit);

  const metrics: OverviewComputation["metrics"] = {
    revenue: makeMetric(revenue),
    profit: makeMetric(netProfit),
    orders: makeMetric(orders),
    avgOrderValue: makeMetric(averageOrderValue),
    roas: makeMetric(blendedRoas),
    poas: makeMetric(poas),
    contributionMargin: contributionMarginMetric,
    blendedMarketingCost: makeMetric(marketingCost),
    customerAcquisitionCost: makeMetric(customerAcquisitionCost),
    profitPerOrder: makeMetric(averageOrderProfit),
  };

  return {
    summary,
    metrics,
    extras: {
      blendedSessionConversionRate: 0,
      blendedSessionConversionRateChange: 0,
      uniqueVisitors: 0,
    },
  } satisfies OverviewComputation;
}

function buildOrdersOverviewFromAggregates(
  aggregates: AggregatedDailyMetrics,
): OrdersOverviewMetrics {
  const totalOrders = aggregates.orders;
  const totalRevenue = aggregates.revenue;
  const cogs = aggregates.cogs;
  const shippingCosts = aggregates.shippingCosts;
  const transactionFees = aggregates.transactionFees;
  const handlingFees = aggregates.handlingFees;
  const taxesCollected = aggregates.taxesCollected;
  const marketingCost = aggregates.marketingCost;
  const refundsAmount = aggregates.refundsAmount;
  const totalCosts =
    cogs +
    shippingCosts +
    transactionFees +
    handlingFees +
    taxesCollected +
    marketingCost +
    refundsAmount;
  const netProfit = totalRevenue - totalCosts;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - cogs) / totalRevenue) * 100 : 0;
  const customerAcquisitionCost = aggregates.newCustomers > 0
    ? aggregates.marketingCost / aggregates.newCustomers
    : 0;
  const fulfilledOrders = Math.max(0, totalOrders - aggregates.cancelledOrders);
  const fulfillmentRate = totalOrders > 0 ? (fulfilledOrders / totalOrders) * 100 : 0;

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
    changes: {
      totalOrders: 0,
      revenue: 0,
      netProfit: 0,
      avgOrderValue: 0,
      cac: 0,
      margin: 0,
      fulfillmentRate: 0,
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

function accumulatePnLMetrics(target: PnLMetrics, addition: PnLMetrics): void {
  target.grossSales += addition.grossSales;
  target.discounts += addition.discounts;
  target.refunds += addition.refunds;
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
  const cogs = toNumber(doc.totalCogs);
  const shippingCosts = toNumber(doc.totalShippingCost);
  const transactionFees = toNumber(doc.totalTransactionFees);
  const handlingFees = toNumber(doc.totalHandlingFee);
  const taxesCollected = toNumber(doc.totalTaxes);
  const adSpend = toNumber(doc.blendedMarketingCost);

  const grossSales = revenue; // daily snapshot records net revenue only
  const discounts = 0;
  const refunds = 0;
  const customCosts = 0;

  const grossProfit = revenue - cogs;
  const netProfit = revenue - (cogs + shippingCosts + transactionFees + handlingFees + taxesCollected + customCosts + adSpend);
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    grossSales,
    discounts,
    refunds,
    revenue,
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

function buildPnLKpisFromTotals(total: PnLMetrics): PnLKPIMetrics {
  const marketingCost = total.totalAdSpend;
  const operatingExpenses = total.customCosts + marketingCost;
  const ebitda = total.netProfit + marketingCost;
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
  } satisfies PnLKPIMetrics;
}

export type DailyMetricsOverview = {
  overview: OverviewComputation;
  platformMetrics: PlatformMetrics;
  ordersOverview: OrdersOverviewMetrics;
  meta: Record<string, unknown>;
  hasFullCoverage: boolean;
};

export async function loadOverviewFromDailyMetrics(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
): Promise<DailyMetricsOverview | null> {
  const metrics = await ctx.db
    .query("dailyMetrics")
    .withIndex("by_organization_date", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("date", range.startDate)
        .lte("date", range.endDate),
    )
    .order("asc")
    .collect();

  if (metrics.length === 0) {
    return null;
  }

  const aggregates = mergeDailyMetrics(metrics);

  const overview = buildOverviewFromAggregates(aggregates);
  const platformMetrics = buildPlatformMetricsFromAggregates(aggregates);
  const ordersOverview = buildOrdersOverviewFromAggregates(aggregates);

  const coverageStart = metrics[0]?.date ?? range.startDate;
  const coverageEnd = metrics[metrics.length - 1]?.date ?? range.endDate;
  const hasFullCoverage = coverageStart <= range.startDate && coverageEnd >= range.endDate;

  const derivedAbandoned = Math.max(0, aggregates.totalCustomers - aggregates.paidCustomers);

  const meta = {
    source: "dailyMetrics",
    days: metrics.length,
    coverage: {
      start: coverageStart,
      end: coverageEnd,
      requested: {
        start: range.startDate,
        end: range.endDate,
      },
    },
    paymentBreakdown: {
      prepaidOrders: aggregates.prepaidOrders,
      codOrders: aggregates.codOrders,
      otherOrders: aggregates.otherOrders,
    },
    customerBreakdown: {
      paidCustomers: aggregates.paidCustomers,
      totalCustomers: aggregates.totalCustomers,
      newCustomers: aggregates.newCustomers,
      returningCustomers: aggregates.returningCustomers,
      repeatCustomers: aggregates.repeatCustomers,
      abandonedCustomers: derivedAbandoned,
    },
  } satisfies Record<string, unknown>;

  return {
    overview,
    platformMetrics,
    ordersOverview,
    meta,
    hasFullCoverage,
  };
}

export interface DailyPnLMeta {
  hasData: boolean;
  coverage: {
    firstAvailable: string | null;
    lastAvailable: string | null;
    requested: DateRange;
  };
  availableDays: number;
  expectedDays: number | null;
  hasFullCoverage: boolean | null;
}

export async function loadPnLAnalyticsFromDailyMetrics(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
  granularity: PnLGranularity,
): Promise<{ result: PnLAnalyticsResult; meta: DailyPnLMeta }> {
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

  const uniqueDates = Array.from(new Set(docs.map((doc) => doc.date)));
  const availableDays = uniqueDates.length;

  const coverageStart = uniqueDates[0] ?? null;
  const coverageEnd = uniqueDates[uniqueDates.length - 1] ?? null;

  const rangeStartMs = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const rangeEndMs = Date.parse(`${range.endDate}T00:00:00.000Z`);
  const coverageStartMs = coverageStart ? Date.parse(`${coverageStart}T00:00:00.000Z`) : null;
  const coverageEndMs = coverageEnd ? Date.parse(`${coverageEnd}T00:00:00.000Z`) : null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const expectedDays = Number.isFinite(rangeStartMs) && Number.isFinite(rangeEndMs)
    ? Math.floor((rangeEndMs - rangeStartMs) / DAY_MS) + 1
    : null;

  const hasFullCoverage = expectedDays !== null && coverageStartMs !== null && coverageEndMs !== null
    ? coverageStartMs <= rangeStartMs && coverageEndMs >= rangeEndMs && availableDays >= expectedDays
    : null;

  const totals = createEmptyPnLMetrics();
  const buckets = new Map<
    string,
    {
      label: string;
      date: string;
      rangeStartMs: number;
      rangeEndMs: number;
      metrics: PnLMetrics;
    }
  >();

  for (const doc of docs) {
    const metrics = metricsFromDailyMetricDoc(doc);
    accumulatePnLMetrics(totals, metrics);

    const parsed = Date.parse(`${doc.date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    const period = getPnLPeriodKey(new Date(parsed), granularity);
    let bucket = buckets.get(period.key);
    if (!bucket) {
      bucket = {
        label: period.label,
        date: period.date,
        rangeStartMs: period.rangeStartMs,
        rangeEndMs: period.rangeEndMs,
        metrics: createEmptyPnLMetrics(),
      };
      buckets.set(period.key, bucket);
    }

    accumulatePnLMetrics(bucket.metrics, metrics);
  }

  const totalsFinal = finalizePnLMetrics(totals);

  const hasData = availableDays > 0;

  const periods: PnLTablePeriod[] = hasData
    ? Array.from(buckets.values())
        .sort((a, b) => a.rangeStartMs - b.rangeStartMs)
        .map((bucket) => ({
          label: bucket.label,
          date: bucket.date,
          metrics: finalizePnLMetrics(bucket.metrics),
          growth: null,
        }))
    : [];

  if (hasData && periods.length > 0) {
    periods.push({
      label: "Total",
      date: range.endDate,
      metrics: totalsFinal,
      growth: null,
      isTotal: true,
    });
  }

  const exportRows = hasData
    ? periods
        .filter((period) => !period.isTotal)
        .map((period) => ({
          Period: period.label,
          NetRevenue: period.metrics.revenue,
          Discounts: period.metrics.discounts,
          Returns: period.metrics.refunds,
          COGS: period.metrics.cogs,
          Shipping: period.metrics.shippingCosts,
          TransactionFees: period.metrics.transactionFees,
          HandlingFees: period.metrics.handlingFees,
          GrossProfit: period.metrics.grossProfit,
          Taxes: period.metrics.taxesCollected,
          OperatingCosts: period.metrics.customCosts,
          AdSpend: period.metrics.totalAdSpend,
          NetProfit: period.metrics.netProfit,
          NetMargin: period.metrics.netProfitMargin,
        }))
    : [];

  const metrics = hasData ? buildPnLKpisFromTotals(totalsFinal) : null;

  return {
    result: {
      metrics,
      periods,
      exportRows,
      totals: totalsFinal,
    },
    meta: {
      hasData,
      coverage: {
        firstAvailable: coverageStart,
        lastAvailable: coverageEnd,
        requested: range,
      },
      availableDays,
      expectedDays,
      hasFullCoverage,
    },
  };
}
