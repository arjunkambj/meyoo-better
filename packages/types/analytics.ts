export const ANALYTICS_DATASET_KEYS = [
  "orders",
  "orderItems",
  "transactions",
  "refunds",
  "fulfillments",
  "products",
  "variants",
  "customers",
  "metaInsights",
  "globalCosts",
  "variantCosts",
  "manualReturnRates",
  "sessions",
  "analytics",
] as const;

export type AnalyticsDatasetKey = (typeof ANALYTICS_DATASET_KEYS)[number];

export interface AnalyticsDateRange {
  startDate: string;
  endDate: string;
  preset?: string;
  startDateTimeUtc?: string;
  endDateTimeUtc?: string;
  endDateTimeUtcExclusive?: string;
  dayCount?: number;
}

export type AnalyticsSourceData<TRecord = unknown> = Record<
  AnalyticsDatasetKey,
  TRecord[]
>;

export interface AnalyticsSourceResponse<TRecord = unknown> {
  organizationId: string;
  dateRange: AnalyticsDateRange;
  data: AnalyticsSourceData<TRecord>;
}

export type AnalyticsDatasetCounts = Record<AnalyticsDatasetKey, number>;

export interface AnalyticsCalculationSummary {
  durationMs: number;
  datasetCounts: AnalyticsDatasetCounts;
}

// ===== Aggregated Analytics DTOs =====

export interface MetricValue {
  value: number;
  change: number;
  previousValue?: number;
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
  rtoRevenueLost: number;
  rtoRevenueLostChange: number;
  manualReturnRate: number;
  manualReturnRateChange: number;
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
  blendedMarketingCost: number;
  blendedMarketingCostChange: number;
  metaAdSpend: number;
  metaAdSpendChange: number;
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
  fulfillmentCostPerOrder: number;
  fulfillmentCostPerOrderChange: number;
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
  abandonedCustomers: number;
  abandonedCustomersChange: number;
  abandonedRate: number;
  abandonedRateChange: number;
  returnRate: number;
  returnRateChange: number;
  moMRevenueGrowth: number;
  calendarMoMRevenueGrowth: number;
}

export interface OverviewExtras {
  blendedSessionConversionRate: number;
  blendedSessionConversionRateChange: number;
  uniqueVisitors: number;
}

export interface OverviewComputation {
  summary: OverviewSummary;
  metrics: Record<string, MetricValue>;
  extras: OverviewExtras;
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

export interface OrdersOverviewMetrics {
  totalOrders: number;
  cancelledOrders?: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  totalTax: number;
  avgOrderValue: number;
  customerAcquisitionCost: number;
  grossMargin: number;
  fulfillmentRate: number;
  prepaidRate: number;
  repeatRate: number;
  rtoRevenueLoss: number;
  abandonedCustomers: number;
  changes: {
    totalOrders: number;
    revenue: number;
    netProfit: number;
    avgOrderValue: number;
    cac: number;
    margin: number;
    fulfillmentRate: number;
    prepaidRate: number;
    repeatRate: number;
    rtoRevenueLoss: number;
    abandonedCustomers: number;
  };
}

export interface AnalyticsOrderLineItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface AnalyticsOrder {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
  };
  status: string;
  fulfillmentStatus: string;
  financialStatus: string;
  items: number;
  totalPrice: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  taxAmount: number;
  shippingCost: number;
  paymentMethod: string;
  tags?: string[];
  shippingAddress: {
    city: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
  lineItems?: AnalyticsOrderLineItem[];
}

export interface OrdersPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OrdersFulfillmentMetrics {
  avgProcessingTime: number;
  avgShippingTime: number;
  avgDeliveryTime: number;
  onTimeDeliveryRate: number;
  fulfillmentAccuracy: number;
  returnRate: number;
  avgFulfillmentCost?: number;
  totalOrders?: number;
}

export interface OrdersAnalyticsExportRow {
  'Order Number': string;
  Customer: string;
  Email: string;
  Status: string;
  'Fulfillment Status': string;
  'Financial Status': string;
  Items: number;
  Revenue: number;
  Costs: number;
  Profit: number;
  'Profit Margin': number;
  Shipping: number;
  Tax: number;
  Payment: string;
  'Ship To': string;
  'Created At': string;
  'Updated At': string;
}

export interface OrdersAnalyticsResult {
  overview: OrdersOverviewMetrics | null;
  orders: {
    data: AnalyticsOrder[];
    pagination: OrdersPagination;
  } | null;
  fulfillment: OrdersFulfillmentMetrics | null;
  exportRows: OrdersAnalyticsExportRow[];
}

export type PnLGranularity = 'daily' | 'weekly' | 'monthly';

export interface PnLMetrics {
  grossSales: number;
  discounts: number;
  refunds: number;
  rtoRevenueLost: number;
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

export interface PnLKPIMetrics {
  grossSales: number;
  discountsReturns: number;
  netRevenue: number;
  grossProfit: number;
  operatingExpenses: number;
  ebitda: number;
  netProfit: number;
  netMargin: number;
  marketingCost: number;
  marketingROAS: number;
  marketingROI: number;
  changes: {
    grossSales: number;
    discountsReturns: number;
    netRevenue: number;
    grossProfit: number;
    operatingExpenses: number;
    ebitda: number;
    netProfit: number;
    netMargin: number;
    marketingCost: number;
    marketingROAS: number;
    marketingROI: number;
  };
}

export interface PnLAnalyticsResult {
  metrics: PnLKPIMetrics | null;
  periods: PnLTablePeriod[];
  exportRows: Array<Record<string, string | number>>;
  totals: PnLMetrics;
}
