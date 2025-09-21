import type { Id } from "@repo/convex/dataModel";

// Metric types
export interface Metrics {
  _id: Id<"metricsDaily">;
  organizationId: string;
  date: string; // YYYY-MM-DD
  hour?: number; // 0-23 for hourly data

  // General Metrics
  orders: number;
  unitsSold: number;
  revenue: number;

  totalCosts: number;
  netProfit: number;
  netProfitMargin: number;
  grossSales: number;
  grossProfit: number;
  grossProfitMargin: number;
  discounts: number;
  refunds: number;

  // Cost Breakdown
  cogs: number;
  handlingFees: number;
  totalAdSpend: number;
  shippingCosts: number;
  customCosts: number;
  transactionFees: number;
  taxesPaid: number;

  // Order Summary
  avgOrderValue: number;
  avgOrderCost: number;
  avgOrderProfit: number;
  adSpendPerOrder: number;

  // Customer Summary
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatCustomerRate?: number;
  repurchaseRate?: number;
  customerAcquisitionCost: number;
  customerLifetimeValue?: number;
  ltvToCACRatio?: number;

  // Others
  shippingCharged: number;
  taxesCollected: number;
  
  returns: number;

  // Total Ad Spend
  blendedAdSpend: number;
  blendedRoas: number;
  blendedCPM?: number;
  blendedCPC?: number;
  blendedCTR?: number;
  blendedConversionRate?: number;

  // Session & Conversion Tracking
  uniqueVisitors?: number;
  shopifySessions?: number;
  shopifyConversionRate?: number;
  metaClicks?: number;
  metaPurchases?: number;
  metaConversionRate?: number;
  googleClicks?: number;
  googleConversions?: number;
  googleConversionRate?: number;
  blendedSessionConversionRate?: number;

  // Marketing Channel Breakdown
  metaAdSpend?: number;
  googleAdSpend?: number;
  metaSpendPercentage?: number;
  googleSpendPercentage?: number;
  marketingPercentageOfGross?: number;
  marketingPercentageOfNet?: number;
  metaROAS?: number;
  googleROAS?: number;

  // Cost Structure Percentages
  cogsPercentageOfGross?: number;
  cogsPercentageOfNet?: number;
  shippingPercentageOfGross?: number;
  shippingPercentageOfNet?: number;
  transactionFeesPercentage?: number;
  taxesPercentageOfRevenue?: number;
  handlingFeesPercentage?: number;
  customCostsPercentage?: number;
  discountRate?: number;

  // Profitability Margins
  contributionMargin?: number;
  contributionMarginPercentage?: number;
  operatingMargin?: number;

  // Customer Economics
  cacPercentageOfAOV?: number;
  cacPaybackPeriod?: number;
  profitPerCustomer?: number;

  // Unit Economics
  profitPerOrder?: number;
  profitPerUnit?: number;
  fulfillmentCostPerOrder?: number;

  // Operational Efficiency
  inventoryTurnover?: number;
  returnProcessingCost?: number;

  // Existing Rates & Percentages
  cancelledOrderRate?: number;
  returnRate?: number;
  refundRate?: number;

  // Growth Metrics
  moMRevenueGrowth?: number;

  // Currency information
  currency?: string;

  // Metadata
  updatedAt?: number;
  lastSyncedAt?: number;
  _creationTime?: number;
}

export interface PlatformMetrics {
  meta?: MetaMetrics;
  google?: GoogleMetrics;
}

export interface MetaMetrics {
  adSpend: number;
  revenue: number;
  roas: number;
  clicks: number;
  impressions: number;
  cpm: number;
  cac: number;
  ctr: number;
  conversions: number;
  conversionValue: number;
}

export interface GoogleMetrics {
  adSpend: number;
  revenue: number;
  roas: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpm: number;
  cac: number;
  ctr: number;
  conversionValue: number;
}

// Product metrics
export interface ProductMetrics {
  _id: Id<"productMetrics">;
  organizationId: string;
  productId: Id<"shopifyProducts">;
  date: string;

  // Sales metrics
  unitsSold: number;
  revenue: number;
  orders: number;

  // Cost metrics
  cogs: number;
  totalCost: number;
  profit: number;
  profitMargin: number;

  // Inventory
  startingInventory?: number;
  endingInventory?: number;

  // Returns
  unitsReturned?: number;
  returnRate?: number;

  // Metadata
  syncedAt: string;
}

// Channel metrics
export interface ChannelMetrics {
  _id: Id<"channelMetrics">;
  organizationId: string;
  date: string;

  // Channel info
  channel: string;
  source?: string;
  medium?: string;
  campaign?: string;

  // Performance
  orders: number;
  revenue: number;
  adSpend: number;
  profit: number;
  roas: number;

  // Traffic
  sessions?: number;
  conversionRate?: number;

  // Customer metrics
  newCustomers?: number;
  cac?: number;

  // Metadata
  syncedAt: string;
}

// Customer metrics
export interface CustomerMetrics {
  _id: Id<"customerMetrics">;
  organizationId: string;
  customerId: Id<"shopifyCustomers">;

  // Lifetime metrics
  firstOrderDate: string;
  lastOrderDate: string;

  // Value metrics
  lifetimeValue: number;
  lifetimeOrders: number;
  lifetimeProfit: number;
  avgOrderValue: number;

  // Frequency
  daysBetweenPurchases?: number;

  // Attribution
  firstTouchChannel?: string;
  lastTouchChannel?: string;

  // Status
  isActive: boolean;
  churnRisk?: "low" | "medium" | "high";

  // Segments
  segment?: string;
  cohort?: string;

  // Metadata
  calculatedAt: string;
}

// Real-time metrics
export interface RealtimeMetrics {
  _id: Id<"realtimeMetrics">;
  organizationId: string;
  metricType: string;

  // Values
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;

  // Time range
  period: string;

  // Metadata
  calculatedAt: string;
  ttl: number;
}

// Weekly metrics (same structure as daily)
export interface MetricsWeekly extends Omit<Metrics, "_id" | "date" | "hour"> {
  _id: Id<"metricsWeekly">;
  yearWeek: string; // "2024-W01" format
  startDate: string;
  endDate: string;
}

// Monthly metrics (same structure as daily)
export interface MetricsMonthly extends Omit<Metrics, "_id" | "date" | "hour"> {
  _id: Id<"metricsMonthly">;
  yearMonth: string; // "2024-01" format
}

// Real-time metrics (always today's data)
// Legacy MetricsRealtime removed; use RealtimeMetrics above

// Date range types
export interface DateRange {
  start: string;
  end: string;
  preset?: string;
}

// Comparison types
export interface MetricComparison {
  type: "previous_period" | "previous_year" | "custom";
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
}
