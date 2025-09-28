import type { AnalyticsDatasetKey } from "@repo/types/analytics";
import type { AnalyticsSourceData, AnalyticsSourceResponse } from "@repo/types/analytics";
export type {
  AnalyticsSourceData,
  AnalyticsSourceResponse,
} from "@repo/types/analytics";

export interface MetricValue {
  value: number;
  change: number;
}

export interface OverviewSummary {
  revenue: number;
  revenueChange: number;
  grossSales: number;
  grossSalesChange: number;
  discounts: number;
  discountsChange: number;
  discountRate: number;
  discountRateChange: number;
  refunds: number;
  refundsChange: number;
  profit: number;
  profitChange: number;
  profitMargin: number;
  profitMarginChange: number;
  grossProfit: number;
  grossProfitChange: number;
  grossProfitMargin: number;
  grossProfitMarginChange: number;
  contributionMargin: number;
  contributionMarginChange: number;
  contributionMarginPercentage: number;
  contributionMarginPercentageChange: number;
  operatingMargin: number;
  operatingMarginChange: number;
  adSpend: number;
  adSpendChange: number;
  totalAdSpend: number;
  totalAdSpendChange: number;
  metaAdSpend: number;
  metaAdSpendChange: number;
  googleAdSpend: number;
  googleAdSpendChange: number;
  metaSpendPercentage: number;
  metaSpendPercentageChange: number;
  marketingPercentageOfGross: number;
  marketingPercentageOfGrossChange: number;
  marketingPercentageOfNet: number;
  marketingPercentageOfNetChange: number;
  metaROAS: number;
  metaROASChange: number;
  roas: number;
  roasChange: number;
  ncROAS: number;
  ncROASChange: number;
  poas: number;
  poasChange: number;
  orders: number;
  ordersChange: number;
  unitsSold: number;
  unitsSoldChange: number;
  avgOrderValue: number;
  avgOrderValueChange: number;
  avgOrderCost: number;
  avgOrderCostChange: number;
  avgOrderProfit: number;
  avgOrderProfitChange: number;
  adSpendPerOrder: number;
  adSpendPerOrderChange: number;
  profitPerOrder: number;
  profitPerOrderChange: number;
  profitPerUnit: number;
  profitPerUnitChange: number;
  cogs: number;
  cogsChange: number;
  cogsPercentageOfGross: number;
  cogsPercentageOfGrossChange: number;
  cogsPercentageOfNet: number;
  cogsPercentageOfNetChange: number;
  shippingCosts: number;
  shippingCostsChange: number;
  shippingPercentageOfNet: number;
  shippingPercentageOfNetChange: number;
  transactionFees: number;
  transactionFeesChange: number;
  handlingFees: number;
  handlingFeesChange: number;
  taxesCollected: number;
  taxesCollectedChange: number;
  taxesPercentageOfRevenue: number;
  taxesPercentageOfRevenueChange: number;
  customCosts: number;
  customCostsChange: number;
  customCostsPercentage: number;
  customCostsPercentageChange: number;
  customers: number;
  customersChange: number;
  newCustomers: number;
  newCustomersChange: number;
  returningCustomers: number;
  returningCustomersChange: number;
  repeatCustomerRate: number;
  repeatCustomerRateChange: number;
  customerAcquisitionCost: number;
  customerAcquisitionCostChange: number;
  cacPercentageOfAOV: number;
  cacPercentageOfAOVChange: number;
  returnRate: number;
  returnRateChange: number;
  moMRevenueGrowth: number;
  calendarMoMRevenueGrowth: number;
}

export interface OverviewComputation {
  summary: OverviewSummary;
  metrics: Record<string, MetricValue>;
  extras: {
    blendedSessionConversionRate: number;
    blendedSessionConversionRateChange: number;
    uniqueVisitors: number;
  };
}

export interface PlatformMetrics {
  shopifyConversionRate: number;
  shopifyAbandonedCarts: number;
  shopifyCheckoutRate: number;
  metaSessions: number;
  metaClicks: number;
  metaConversion: number;
  metaConversionRate: number;
  metaImpressions: number;
  metaCTR: number;
  metaCPM: number;
  metaReach: number;
  metaFrequency: number;
  metaUniqueClicks: number;
  metaCPC: number;
  metaCostPerConversion: number;
  metaAddToCart: number;
  metaInitiateCheckout: number;
  metaPageViews: number;
  metaViewContent: number;
  metaLinkClicks: number;
  metaOutboundClicks: number;
  metaLandingPageViews: number;
  metaVideoViews: number;
  metaVideo3SecViews: number;
  metaCostPerThruPlay: number;
  blendedCPM: number;
  blendedCPC: number;
  blendedCTR: number;
}

export interface ChannelRevenueBreakdown {
  channels: Array<{
    name: string;
    revenue: number;
    orders: number;
    change: number;
  }>;
}

function toStringId(id: unknown): string {
  if (typeof id === "string") return id;
  if (id && typeof id === "object") {
    if ("id" in (id as Record<string, unknown>) && typeof (id as any).id === "string") {
      return (id as any).id;
    }
    if ("_id" in (id as Record<string, unknown>) && typeof (id as any)._id === "string") {
      return (id as any)._id;
    }
  }
  return String(id ?? "");
}

function sumBy<T>(items: T[] | undefined, getter: (item: T) => number): number {
  if (!items?.length) return 0;
  return items.reduce((total, item) => total + getter(item), 0);
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function monthsBetween(start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 1;
  }
  const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end - start) / MS_PER_MONTH));
}

function computeCostAmount(options: {
  cost: any;
  revenue: number;
  orders: number;
  units: number;
  rangeStart: number;
  rangeEnd: number;
}): number {
  const { cost, revenue, orders, units, rangeStart, rangeEnd } = options;
  if (!cost || cost.isActive === false) {
    return 0;
  }

  const baseValue = safeNumber(cost.value);
  const calculation = cost.calculation as string | undefined;
  const frequency = cost.frequency as string | undefined;

  let amount = 0;

  switch (calculation) {
    case "percentage":
      amount = revenue * (baseValue / 100);
      break;
    case "per_order":
      amount = orders * baseValue;
      break;
    case "per_item":
    case "per_unit":
      amount = units * baseValue;
      break;
    case "fixed":
    case "formula":
    default:
      amount = baseValue;
      break;
  }

  if (!frequency) {
    return amount;
  }

  const windowMs = rangeEnd - rangeStart;
  const days = windowMs > 0 ? windowMs / (24 * 60 * 60 * 1000) : 30;

  switch (frequency) {
    case "daily":
      return amount * Math.max(1, days);
    case "weekly":
      return amount * Math.max(1, days / 7);
    case "monthly":
      return amount * monthsBetween(rangeStart, rangeEnd);
    case "quarterly":
      return amount * (monthsBetween(rangeStart, rangeEnd) / 3);
    case "yearly":
      return amount * (monthsBetween(rangeStart, rangeEnd) / 12);
    default:
      return amount;
  }
}

export function computeOverviewMetrics(
  response: AnalyticsSourceResponse<any> | null | undefined,
): OverviewComputation | null {
  if (!response) {
    return null;
  }

  const data = (response.data || {}) as AnalyticsSourceData<any>;
  const orders = (data.orders || []) as any[];
  const orderItems = (data.orderItems || []) as any[];
  const transactions = (data.transactions || []) as any[];
  const refunds = (data.refunds || []) as any[];
  const metaInsights = (data.metaInsights || []) as any[];
  const costs = (data.costs || []) as any[];
  const productCostComponents = (data.productCostComponents || []) as any[];
  const variants = (data.variants || []) as any[];
  const customers = (data.customers || []) as any[];
  const analytics = (data.analytics || []) as any[];

  const revenue = sumBy(orders, (order) => safeNumber(order.totalPrice));
  const grossSales = sumBy(orders, (order) => safeNumber(order.subtotalPrice ?? order.totalPrice));
  const discounts = sumBy(orders, (order) => safeNumber(order.totalDiscounts));
  const shippingCosts = sumBy(orders, (order) => safeNumber(order.totalShippingPrice));
  const taxesCollected = sumBy(orders, (order) => safeNumber(order.totalTax));
  const refundsAmount = sumBy(refunds, (refund) => safeNumber(refund.totalRefunded ?? refund.amount));

  const variantMap = new Map<string, any>();
  for (const variant of variants) {
    variantMap.set(toStringId(variant._id ?? variant.id ?? variant.variantId), variant);
  }

  const componentMap = new Map<string, any>();
  for (const component of productCostComponents) {
    const variantId = toStringId(component.variantId ?? component.variant_id);
    if (!variantId) continue;
    const current = componentMap.get(variantId);
    if (!current || safeNumber(component.effectiveFrom) > safeNumber(current?.effectiveFrom)) {
      componentMap.set(variantId, component);
    }
  }

  const variantQuantities = new Map<string, number>();
  for (const item of orderItems) {
    const variantId = toStringId(item.variantId ?? item.variant_id);
    if (!variantId) continue;
    const prev = variantQuantities.get(variantId) ?? 0;
    variantQuantities.set(variantId, prev + safeNumber(item.quantity));
  }

  let cogs = 0;
  let unitsSold = 0;
  for (const item of orderItems) {
    const quantity = safeNumber(item.quantity);
    unitsSold += quantity;
    const variantId = toStringId(item.variantId ?? item.variant_id);
    const component = componentMap.get(variantId);
    const variant = variantMap.get(variantId);
    const perUnit = safeNumber(component?.cogsPerUnit ?? component?.costPerUnit ?? variant?.costPerItem ?? 0);
    cogs += perUnit * quantity;
  }

  let handlingFromComponents = 0;
  for (const [variantId, quantity] of variantQuantities.entries()) {
    const component = componentMap.get(variantId);
    if (!component) continue;
    handlingFromComponents += safeNumber(component?.handlingPerUnit) * quantity;
  }

  const transactionFees = sumBy(transactions, (tx) => safeNumber(tx.fee));

  const customersById = new Map<string, any>();
  for (const customer of customers) {
    customersById.set(toStringId(customer._id ?? customer.id ?? customer.customerId), customer);
  }

  const uniqueCustomerIds = new Set<string>();
  for (const order of orders) {
    const customerId = toStringId(order.customerId ?? order.customer_id);
    if (customerId) {
      uniqueCustomerIds.add(customerId);
    }
  }

  let returningCustomers = 0;
  let newCustomers = 0;
  for (const customerId of uniqueCustomerIds) {
    const customer = customersById.get(customerId);
    const ordersCount = safeNumber(customer?.ordersCount ?? customer?.orders_count);
    if (ordersCount > 1) {
      returningCustomers += 1;
    } else {
      newCustomers += 1;
    }
  }

  const marketingCosts = costs.filter((cost) => cost.type === "marketing");
  const handlingCostEntries = costs.filter((cost) => cost.type === "handling");
  const operationalCosts = costs.filter((cost) => cost.type === "operational" || cost.type === "custom");

  const rangeStart = Date.parse(response.dateRange.startDate ?? new Date().toISOString());
  const rangeEnd = Date.parse(response.dateRange.endDate ?? new Date().toISOString());

  const marketingCostTotal = sumBy(marketingCosts, (cost) =>
    computeCostAmount({
      cost,
      revenue,
      orders: orders.length,
      units: unitsSold,
      rangeStart,
      rangeEnd,
    }),
  );

  const handlingCostTotal =
    sumBy(handlingCostEntries, (cost) =>
      computeCostAmount({
        cost,
        revenue,
        orders: orders.length,
        units: unitsSold,
        rangeStart,
        rangeEnd,
      }),
    ) + handlingFromComponents;

  const customCostTotal = sumBy(operationalCosts, (cost) =>
    computeCostAmount({
      cost,
      revenue,
      orders: orders.length,
      units: unitsSold,
      rangeStart,
      rangeEnd,
    }),
  );

  const metaAdSpend = sumBy(metaInsights, (insight) => safeNumber(insight.spend));
  const metaClicks = sumBy(metaInsights, (insight) => safeNumber(insight.clicks));
  const metaUniqueClicks = sumBy(metaInsights, (insight) => safeNumber(insight.uniqueClicks));
  const metaImpressions = sumBy(metaInsights, (insight) => safeNumber(insight.impressions));
  const metaReach = sumBy(metaInsights, (insight) => safeNumber(insight.reach));
  const metaConversions = sumBy(metaInsights, (insight) => safeNumber(insight.conversions));
  const metaConversionValue = sumBy(metaInsights, (insight) => safeNumber(insight.conversionValue));
  const metaAddToCart = sumBy(metaInsights, (insight) => safeNumber(insight.addToCart));
  const metaInitiateCheckout = sumBy(metaInsights, (insight) => safeNumber(insight.initiateCheckout));
  const metaPageViews = sumBy(metaInsights, (insight) => safeNumber(insight.pageViews));
  const metaViewContent = sumBy(metaInsights, (insight) => safeNumber(insight.viewContent));
  const metaLinkClicks = sumBy(metaInsights, (insight) => safeNumber(insight.linkClicks));
  const metaOutboundClicks = sumBy(metaInsights, (insight) => safeNumber(insight.outboundClicks));
  const metaLandingPageViews = sumBy(metaInsights, (insight) => safeNumber(insight.landingPageViews));
  const metaVideoViews = sumBy(metaInsights, (insight) => safeNumber(insight.videoViews));
  const metaVideo3SecViews = sumBy(metaInsights, (insight) => safeNumber(insight.video3SecViews));
  const metaCostPerThruPlay = sumBy(metaInsights, (insight) => safeNumber(insight.costPerThruPlay));

  const totalAdSpend = metaAdSpend + marketingCostTotal;

  const totalCostsWithoutAds =
    cogs + shippingCosts + transactionFees + handlingCostTotal + customCostTotal + taxesCollected;
  const netProfit = revenue - totalCostsWithoutAds - totalAdSpend - refundsAmount;
  const grossProfit = revenue - cogs;
  const contributionProfit = revenue - (cogs + shippingCosts + transactionFees + handlingCostTotal + customCostTotal);

  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const contributionMarginPercentage = revenue > 0 ? (contributionProfit / revenue) * 100 : 0;
  const averageOrderValue = orders.length > 0 ? revenue / orders.length : 0;
  const averageOrderCost = orders.length > 0 ? (totalCostsWithoutAds + totalAdSpend) / orders.length : 0;
  const averageOrderProfit = orders.length > 0 ? netProfit / orders.length : 0;
  const profitPerUnit = unitsSold > 0 ? netProfit / unitsSold : 0;
  const adSpendPerOrder = orders.length > 0 ? totalAdSpend / orders.length : 0;
  const poas = totalAdSpend > 0 ? netProfit / totalAdSpend : 0;
  const blendedRoas = totalAdSpend > 0 ? revenue / totalAdSpend : 0;
  const metaRoas = metaAdSpend > 0 ? (metaConversionValue || revenue) / metaAdSpend : 0;
  const metaSpendPercentage = totalAdSpend > 0 ? (metaAdSpend / totalAdSpend) * 100 : 0;
  const marketingPercentageOfGross = grossSales > 0 ? (totalAdSpend / grossSales) * 100 : 0;
  const marketingPercentageOfNet = revenue > 0 ? (totalAdSpend / revenue) * 100 : 0;

  const cogsPercentageOfGross = grossSales > 0 ? (cogs / grossSales) * 100 : 0;
  const cogsPercentageOfNet = revenue > 0 ? (cogs / revenue) * 100 : 0;
  const shippingPercentageOfNet = revenue > 0 ? (shippingCosts / revenue) * 100 : 0;
  const taxesPercentageOfRevenue = revenue > 0 ? (taxesCollected / revenue) * 100 : 0;

  const returnRate = orders.length > 0 ? (refunds.length / orders.length) * 100 : 0;
  const customersCount = uniqueCustomerIds.size;
  const repeatCustomerRate = customersCount > 0 ? (returningCustomers / customersCount) * 100 : 0;
  const customerAcquisitionCost = newCustomers > 0 ? totalAdSpend / newCustomers : 0;
  const cacPercentageOfAOV = averageOrderValue > 0 ? (customerAcquisitionCost / averageOrderValue) * 100 : 0;
  const operatingCostPercentage = revenue > 0 ? (customCostTotal / revenue) * 100 : 0;

  const totalSessions = sumBy(analytics, (entry) => safeNumber(entry.sessions ?? entry.visitors ?? entry.visits));
  const totalConversions = sumBy(analytics, (entry) => safeNumber(entry.conversions ?? entry.orders ?? entry.conversion));
  const blendedSessionConversionRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const uniqueVisitors = sumBy(analytics, (entry) => safeNumber(entry.visitors ?? entry.sessions ?? entry.visits));

  const summary: OverviewSummary = {
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
    adSpend: totalAdSpend,
    adSpendChange: 0,
    totalAdSpend,
    totalAdSpendChange: 0,
    metaAdSpend,
    metaAdSpendChange: 0,
    googleAdSpend: 0,
    googleAdSpendChange: 0,
    metaSpendPercentage,
    metaSpendPercentageChange: 0,
    marketingPercentageOfGross,
    marketingPercentageOfGrossChange: 0,
    marketingPercentageOfNet,
    marketingPercentageOfNetChange: 0,
    metaROAS: metaRoas,
    metaROASChange: 0,
    roas: blendedRoas,
    roasChange: 0,
    ncROAS: blendedRoas,
    ncROASChange: 0,
    poas,
    poasChange: 0,
    orders: orders.length,
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
    handlingFees: handlingCostTotal,
    handlingFeesChange: 0,
    taxesCollected,
    taxesCollectedChange: 0,
    taxesPercentageOfRevenue,
    taxesPercentageOfRevenueChange: 0,
  customCosts: customCostTotal,
  customCostsChange: 0,
  customCostsPercentage: operatingCostPercentage,
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

  const metrics: Record<string, MetricValue> = {
    revenue: { value: summary.revenue, change: summary.revenueChange },
    netProfit: { value: summary.profit, change: summary.profitChange },
    netProfitMargin: { value: summary.profitMargin, change: summary.profitMarginChange },
    orders: { value: summary.orders, change: summary.ordersChange },
    avgOrderValue: { value: summary.avgOrderValue, change: summary.avgOrderValueChange },
    blendedRoas: { value: summary.roas, change: summary.roasChange },
    grossSales: { value: summary.grossSales, change: summary.grossSalesChange },
    discounts: { value: summary.discounts, change: summary.discountsChange },
    discountRate: { value: summary.discountRate, change: summary.discountRateChange },
    grossProfit: { value: summary.grossProfit, change: summary.grossProfitChange },
    grossProfitMargin: { value: summary.grossProfitMargin, change: summary.grossProfitMarginChange },
    contributionMargin: { value: summary.contributionMargin, change: summary.contributionMarginChange },
    contributionMarginPercentage: {
      value: summary.contributionMarginPercentage,
      change: summary.contributionMarginPercentageChange,
    },
    operatingMargin: { value: summary.operatingMargin, change: summary.operatingMarginChange },
    totalAdSpend: { value: summary.totalAdSpend, change: summary.totalAdSpendChange },
    metaAdSpend: { value: summary.metaAdSpend, change: summary.metaAdSpendChange },
    metaSpendPercentage: { value: summary.metaSpendPercentage, change: summary.metaSpendPercentageChange },
    marketingPercentageOfGross: {
      value: summary.marketingPercentageOfGross,
      change: summary.marketingPercentageOfGrossChange,
    },
    marketingPercentageOfNet: {
      value: summary.marketingPercentageOfNet,
      change: summary.marketingPercentageOfNetChange,
    },
    metaROAS: { value: summary.metaROAS, change: summary.metaROASChange },
    moMRevenueGrowth: { value: summary.moMRevenueGrowth, change: 0 },
    calendarMoMRevenueGrowth: { value: summary.calendarMoMRevenueGrowth, change: 0 },
    cogs: { value: summary.cogs, change: summary.cogsChange },
    cogsPercentageOfGross: {
      value: summary.cogsPercentageOfGross,
      change: summary.cogsPercentageOfGrossChange,
    },
    cogsPercentageOfNet: {
      value: summary.cogsPercentageOfNet,
      change: summary.cogsPercentageOfNetChange,
    },
    shippingCosts: { value: summary.shippingCosts, change: summary.shippingCostsChange },
    shippingPercentageOfNet: {
      value: summary.shippingPercentageOfNet,
      change: summary.shippingPercentageOfNetChange,
    },
    transactionFees: {
      value: summary.transactionFees,
      change: summary.transactionFeesChange,
    },
    taxesCollected: { value: summary.taxesCollected, change: summary.taxesCollectedChange },
    taxesPercentageOfRevenue: {
      value: summary.taxesPercentageOfRevenue,
      change: summary.taxesPercentageOfRevenueChange,
    },
    handlingFees: { value: summary.handlingFees, change: summary.handlingFeesChange },
    customCosts: { value: summary.customCosts, change: summary.customCostsChange },
    returningCustomers: {
      value: summary.returningCustomers,
      change: summary.returningCustomersChange,
    },
    repeatCustomerRate: {
      value: summary.repeatCustomerRate,
      change: summary.repeatCustomerRateChange,
    },
    customerAcquisitionCost: {
      value: summary.customerAcquisitionCost,
      change: summary.customerAcquisitionCostChange,
    },
    cacPercentageOfAOV: {
      value: summary.cacPercentageOfAOV,
      change: summary.cacPercentageOfAOVChange,
    },
    unitsSold: { value: summary.unitsSold, change: summary.unitsSoldChange },
    avgOrderProfit: {
      value: summary.avgOrderProfit,
      change: summary.avgOrderProfitChange,
    },
    profitPerOrder: {
      value: summary.profitPerOrder,
      change: summary.profitPerOrderChange,
    },
    profitPerUnit: {
      value: summary.profitPerUnit,
      change: summary.profitPerUnitChange,
    },
    totalCustomers: { value: summary.customers, change: summary.customersChange },
    newCustomers: { value: summary.newCustomers, change: summary.newCustomersChange },
    adSpendPerOrder: {
      value: summary.adSpendPerOrder,
      change: summary.adSpendPerOrderChange,
    },
    returnRate: { value: summary.returnRate, change: summary.returnRateChange },
    poas: { value: summary.poas, change: summary.poasChange },
  };

  const extras = {
    blendedSessionConversionRate,
    blendedSessionConversionRateChange: 0,
    uniqueVisitors,
  };

  return { summary, metrics, extras };
}

export function computePlatformMetrics(
  response: AnalyticsSourceResponse<any> | null | undefined,
): PlatformMetrics {
  if (!response) {
    return {
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
  }

  const data = response.data as AnalyticsSourceData<any>;
  const analytics = (data.analytics || []) as any[];
  const metaInsights = (data.metaInsights || []) as any[];

  const shopifySessions = sumBy(analytics, (entry) => safeNumber(entry.sessions ?? entry.visitors ?? entry.visits));
  const shopifyConversions = sumBy(analytics, (entry) => safeNumber(entry.conversions ?? entry.orders ?? entry.conversion));

  const metaClicks = sumBy(metaInsights, (entry) => safeNumber(entry.clicks));
  const metaUniqueClicks = sumBy(metaInsights, (entry) => safeNumber(entry.uniqueClicks));
  const metaImpressions = sumBy(metaInsights, (entry) => safeNumber(entry.impressions));
  const metaReach = sumBy(metaInsights, (entry) => safeNumber(entry.reach));
  const metaSpend = sumBy(metaInsights, (entry) => safeNumber(entry.spend));
  const metaConversions = sumBy(metaInsights, (entry) => safeNumber(entry.conversions));
  const metaAddToCart = sumBy(metaInsights, (entry) => safeNumber(entry.addToCart));
  const metaInitiateCheckout = sumBy(metaInsights, (entry) => safeNumber(entry.initiateCheckout));
  const metaPageViews = sumBy(metaInsights, (entry) => safeNumber(entry.pageViews));
  const metaViewContent = sumBy(metaInsights, (entry) => safeNumber(entry.viewContent));
  const metaLinkClicks = sumBy(metaInsights, (entry) => safeNumber(entry.linkClicks));
  const metaOutboundClicks = sumBy(metaInsights, (entry) => safeNumber(entry.outboundClicks));
  const metaLandingPageViews = sumBy(metaInsights, (entry) => safeNumber(entry.landingPageViews));
  const metaVideoViews = sumBy(metaInsights, (entry) => safeNumber(entry.videoViews));
  const metaVideo3SecViews = sumBy(metaInsights, (entry) => safeNumber(entry.video3SecViews));
  const metaCostPerThruPlay = sumBy(metaInsights, (entry) => safeNumber(entry.costPerThruPlay));

  const metaSessions = metaClicks || metaUniqueClicks;
  const metaConversionRate = metaClicks > 0 ? (metaConversions / metaClicks) * 100 : 0;
  const metaCTR = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0;
  const metaCPM = metaImpressions > 0 ? (metaSpend / metaImpressions) * 1000 : 0;
  const metaCPC = metaClicks > 0 ? metaSpend / metaClicks : 0;
  const metaCostPerConversion = metaConversions > 0 ? metaSpend / metaConversions : 0;
  const metaFrequency = metaReach > 0 ? metaImpressions / metaReach : 0;

  const blendedCPM = metaCPM;
  const blendedCPC = metaCPC;
  const blendedCTR = metaCTR;

  return {
    shopifyConversionRate: shopifySessions > 0 ? (shopifyConversions / shopifySessions) * 100 : 0,
    shopifyAbandonedCarts: Math.max(shopifySessions - shopifyConversions, 0),
    shopifyCheckoutRate: shopifySessions > 0 ? (shopifyConversions / shopifySessions) * 100 : 0,
    metaSessions,
    metaClicks,
    metaConversion: metaConversions,
    metaConversionRate,
    metaImpressions,
    metaCTR,
    metaCPM,
    metaReach,
    metaFrequency,
    metaUniqueClicks,
    metaCPC,
    metaCostPerConversion,
    metaAddToCart,
    metaInitiateCheckout,
    metaPageViews,
    metaViewContent,
    metaLinkClicks,
    metaOutboundClicks,
    metaLandingPageViews,
    metaVideoViews,
    metaVideo3SecViews,
    metaCostPerThruPlay,
    blendedCPM,
    blendedCPC,
    blendedCTR,
  };
}

export function computeChannelRevenue(
  response: AnalyticsSourceResponse<any> | null | undefined,
): ChannelRevenueBreakdown {
  if (!response) {
    return { channels: [] };
  }

  const data = response.data as AnalyticsSourceData<any>;
  const orders = (data.orders || []) as any[];

  const channelMap = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    const rawSource =
      order.utmSource ??
      order.utm_source ??
      order.sessionSource ??
      order.referringSite ??
      order.source ??
      "Direct";
    const channel = String(rawSource || "Direct").trim() || "Direct";
    const stats = channelMap.get(channel) ?? { revenue: 0, orders: 0 };
    stats.revenue += safeNumber(order.totalPrice);
    stats.orders += 1;
    channelMap.set(channel, stats);
  }

  const channels = Array.from(channelMap.entries())
    .map(([name, stats]) => ({
      name,
      revenue: stats.revenue,
      orders: stats.orders,
      change: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return { channels };
}

export function isDatasetEmpty(response: AnalyticsSourceResponse<any> | undefined): boolean {
  if (!response) return true;
  const data = response.data as AnalyticsSourceData<any>;
  const keys = Object.keys(data) as AnalyticsDatasetKey[];
  return keys.every((key) => (data[key]?.length ?? 0) === 0);
}
