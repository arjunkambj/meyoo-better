import { defineTable } from "convex/server";
import { v } from "convex/values";

// Daily metrics table for all analytics
export const metricsDaily = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(), // YYYY-MM-DD
  hour: v.optional(v.number()), // 0-23 for hourly data

  // 1. General Metrics
  orders: v.number(),
  unitsSold: v.number(),
  revenue: v.number(),
  totalCosts: v.number(),
  netProfit: v.number(),
  netProfitMargin: v.number(),
  grossSales: v.number(),
  grossProfit: v.number(),
  grossProfitMargin: v.number(),
  discounts: v.number(),
  refunds: v.number(),

  // 2. Cost Breakdown (COSR)
  cogs: v.number(), // Cost of Goods Sold
  handlingFees: v.number(),
  totalAdSpend: v.number(),
  shippingCosts: v.number(),
  customCosts: v.number(),
  transactionFees: v.number(),

  // 3. Order Summary
  avgOrderValue: v.number(),
  avgOrderCost: v.number(),
  avgOrderProfit: v.number(),
  adSpendPerOrder: v.number(),

  // 4. Customer Summary
  totalCustomers: v.number(),
  newCustomers: v.number(),
  returningCustomers: v.number(),
  repeatCustomerRate: v.optional(v.number()),
  customerAcquisitionCost: v.number(),
  ltvToCACRatio: v.optional(v.number()),

  // 5. Others
  shippingCharged: v.number(),
  taxesCollected: v.number(),

  returns: v.number(),

  // 6. Total Ad Spend
  blendedAdSpend: v.number(),
  blendedRoas: v.number(),
  blendedCPM: v.optional(v.number()), // Made optional for existing data
  blendedCPC: v.optional(v.number()), // Made optional for existing data
  blendedCTR: v.optional(v.number()), // Made optional for existing data
  blendedConversionRate: v.optional(v.number()), // Made optional for existing data

  // Session & Conversion Tracking
  uniqueVisitors: v.optional(v.number()), // Unique visitors
  shopifySessions: v.optional(v.number()), // Shopify store sessions
  shopifyConversionRate: v.optional(v.number()), // Shopify session to order conversion rate
  metaClicks: v.optional(v.number()), // Meta ad clicks
  metaPurchases: v.optional(v.number()), // Meta attributed purchases
  metaConversionRate: v.optional(v.number()), // Meta click to purchase conversion rate
  googleClicks: v.optional(v.number()), // Google ad clicks
  googleConversions: v.optional(v.number()), // Google attributed conversions
  googleConversionRate: v.optional(v.number()), // Google click to conversion rate
  blendedSessionConversionRate: v.optional(v.number()), // Overall session to purchase rate

  // 7. Marketing Channel Breakdown
  metaAdSpend: v.optional(v.number()),
  googleAdSpend: v.optional(v.number()),
  metaSpendPercentage: v.optional(v.number()),
  googleSpendPercentage: v.optional(v.number()),
  marketingPercentageOfGross: v.optional(v.number()),
  marketingPercentageOfNet: v.optional(v.number()),
  metaROAS: v.optional(v.number()),
  googleROAS: v.optional(v.number()),

  // 7a. Meta Detailed Metrics
  metaImpressions: v.optional(v.number()),
  metaReach: v.optional(v.number()),
  metaFrequency: v.optional(v.number()),
  metaUniqueClicks: v.optional(v.number()),
  metaCTR: v.optional(v.number()),
  metaCPC: v.optional(v.number()),
  metaCPM: v.optional(v.number()),
  metaCostPerConversion: v.optional(v.number()),
  metaAddToCart: v.optional(v.number()),
  metaInitiateCheckout: v.optional(v.number()),
  metaPageViews: v.optional(v.number()),
  metaViewContent: v.optional(v.number()),

  metaLinkClicks: v.optional(v.number()),
  metaOutboundClicks: v.optional(v.number()),
  metaLandingPageViews: v.optional(v.number()),
  metaVideoViews: v.optional(v.number()),
  metaVideo3SecViews: v.optional(v.number()),
  metaCostPerThruPlay: v.optional(v.number()),

  // 8. Cost Structure Percentages
  cogsPercentageOfGross: v.optional(v.number()),
  cogsPercentageOfNet: v.optional(v.number()),
  shippingPercentageOfNet: v.optional(v.number()),
  taxesPercentageOfRevenue: v.optional(v.number()),
  handlingFeesPercentage: v.optional(v.number()),
  customCostsPercentage: v.optional(v.number()),
  discountRate: v.optional(v.number()),

  // 9. Profitability Margins
  contributionMargin: v.optional(v.number()),
  contributionMarginPercentage: v.optional(v.number()),
  operatingMargin: v.optional(v.number()),

  // 10. Customer Economics
  cacPercentageOfAOV: v.optional(v.number()),
  cacPaybackPeriod: v.optional(v.number()),

  // 11. Unit Economics
  profitPerOrder: v.optional(v.number()),
  profitPerUnit: v.optional(v.number()),
  fulfillmentCostPerOrder: v.optional(v.number()),

  // 12. Operational Efficiency
  inventoryTurnover: v.optional(v.number()),
  returnProcessingCost: v.optional(v.number()),

  // 13. Existing Rates & Percentages
  cancelledOrderRate: v.optional(v.number()),
  returnRate: v.optional(v.number()),
  refundRate: v.optional(v.number()),

  // 14. Growth Metrics
  moMRevenueGrowth: v.optional(v.number()),

  // Metadata
  updatedAt: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_date", ["date"])
  .index("by_org_date", ["organizationId", "date"])
  .index("by_org_date_hour", ["organizationId", "date", "hour"]);

// Weekly aggregated metrics
export const metricsWeekly = defineTable({
  organizationId: v.id("organizations"),
  yearWeek: v.string(), // "2024-W01" format
  startDate: v.string(), // YYYY-MM-DD
  endDate: v.string(), // YYYY-MM-DD

  // All the same metric fields as daily
  orders: v.number(),
  unitsSold: v.number(),
  revenue: v.number(),
  totalCosts: v.number(),
  netProfit: v.number(),
  netProfitMargin: v.number(),
  grossSales: v.number(),
  grossProfit: v.number(),
  grossProfitMargin: v.number(),
  discounts: v.number(),
  refunds: v.number(),

  cogs: v.number(),
  handlingFees: v.number(),
  totalAdSpend: v.number(),
  shippingCosts: v.number(),
  customCosts: v.number(),
  transactionFees: v.number(),

  avgOrderValue: v.number(),
  avgOrderCost: v.number(),
  avgOrderProfit: v.number(),
  adSpendPerOrder: v.number(),

  totalCustomers: v.number(),
  newCustomers: v.number(),
  returningCustomers: v.number(),
  repeatCustomerRate: v.optional(v.number()),
  repurchaseRate: v.optional(v.number()),
  customerAcquisitionCost: v.number(),
  ltvToCACRatio: v.optional(v.number()),

  shippingCharged: v.number(),
  taxesCollected: v.number(),

  returns: v.number(),

  blendedAdSpend: v.number(),
  blendedRoas: v.number(),
  blendedCPM: v.optional(v.number()), // Made optional for existing data
  blendedCPC: v.optional(v.number()), // Made optional for existing data
  blendedCTR: v.optional(v.number()), // Made optional for existing data
  blendedConversionRate: v.optional(v.number()), // Made optional for existing data

  // Marketing Channel Breakdown
  metaAdSpend: v.optional(v.number()),
  googleAdSpend: v.optional(v.number()),
  metaSpendPercentage: v.optional(v.number()),
  googleSpendPercentage: v.optional(v.number()),
  marketingPercentageOfGross: v.optional(v.number()),
  marketingPercentageOfNet: v.optional(v.number()),
  metaROAS: v.optional(v.number()),
  googleROAS: v.optional(v.number()),

  // Meta Detailed Metrics (weekly aggregates)
  metaImpressions: v.optional(v.number()),
  metaReach: v.optional(v.number()),
  metaFrequency: v.optional(v.number()),
  metaUniqueClicks: v.optional(v.number()),
  metaClicks: v.optional(v.number()),
  // Aggregated Meta purchases (click-to-purchase conversions)
  metaPurchases: v.optional(v.number()),
  metaCTR: v.optional(v.number()),
  metaCPC: v.optional(v.number()),
  metaCPM: v.optional(v.number()),
  metaCostPerConversion: v.optional(v.number()),
  metaAddToCart: v.optional(v.number()),
  metaInitiateCheckout: v.optional(v.number()),
  metaPageViews: v.optional(v.number()),
  metaViewContent: v.optional(v.number()),

  metaLinkClicks: v.optional(v.number()),
  metaOutboundClicks: v.optional(v.number()),
  metaLandingPageViews: v.optional(v.number()),
  metaVideoViews: v.optional(v.number()),
  metaVideo3SecViews: v.optional(v.number()),
  metaCostPerThruPlay: v.optional(v.number()),

  // Cost Structure Percentages
  cogsPercentageOfGross: v.optional(v.number()),
  cogsPercentageOfNet: v.optional(v.number()),
  shippingPercentageOfNet: v.optional(v.number()),
  taxesPercentageOfRevenue: v.optional(v.number()),
  handlingFeesPercentage: v.optional(v.number()),
  customCostsPercentage: v.optional(v.number()),
  discountRate: v.optional(v.number()),

  // Profitability Margins
  contributionMargin: v.optional(v.number()),
  contributionMarginPercentage: v.optional(v.number()),
  operatingMargin: v.optional(v.number()),

  // Customer Economics
  cacPercentageOfAOV: v.optional(v.number()),
  cacPaybackPeriod: v.optional(v.number()),

  // Unit Economics
  profitPerOrder: v.optional(v.number()),
  profitPerUnit: v.optional(v.number()),
  fulfillmentCostPerOrder: v.optional(v.number()),

  // Operational Efficiency
  inventoryTurnover: v.optional(v.number()),
  returnProcessingCost: v.optional(v.number()),

  // Existing Rates & Percentages
  cancelledOrderRate: v.optional(v.number()),
  returnRate: v.optional(v.number()),
  refundRate: v.optional(v.number()),

  // Growth Metrics
  moMRevenueGrowth: v.optional(v.number()),

  updatedAt: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_year_week", ["yearWeek"])
  .index("by_org_week", ["organizationId", "yearWeek"])
  .index("by_org_date_range", ["organizationId", "startDate", "endDate"]);

// Monthly aggregated metrics
export const metricsMonthly = defineTable({
  organizationId: v.id("organizations"),
  yearMonth: v.string(), // "2024-01" format

  // All the same metric fields
  orders: v.number(),
  unitsSold: v.number(),
  revenue: v.number(),
  totalCosts: v.number(),
  netProfit: v.number(),
  netProfitMargin: v.number(),
  grossSales: v.number(),
  grossProfit: v.number(),
  grossProfitMargin: v.number(),
  discounts: v.number(),
  refunds: v.number(),

  cogs: v.number(),
  handlingFees: v.number(),
  totalAdSpend: v.number(),
  shippingCosts: v.number(),
  customCosts: v.number(),
  transactionFees: v.number(),

  avgOrderValue: v.number(),
  avgOrderCost: v.number(),
  avgOrderProfit: v.number(),
  adSpendPerOrder: v.number(),

  totalCustomers: v.number(),
  newCustomers: v.number(),
  returningCustomers: v.number(),
  repeatCustomerRate: v.optional(v.number()),
  repurchaseRate: v.optional(v.number()),
  customerAcquisitionCost: v.number(),
  ltvToCACRatio: v.optional(v.number()),

  shippingCharged: v.number(),
  taxesCollected: v.number(),

  returns: v.number(),

  blendedAdSpend: v.number(),
  blendedRoas: v.number(),
  blendedCPM: v.optional(v.number()), // Made optional for existing data
  blendedCPC: v.optional(v.number()), // Made optional for existing data
  blendedCTR: v.optional(v.number()), // Made optional for existing data
  blendedConversionRate: v.optional(v.number()), // Made optional for existing data

  // Marketing Channel Breakdown
  metaAdSpend: v.optional(v.number()),
  googleAdSpend: v.optional(v.number()),
  metaSpendPercentage: v.optional(v.number()),
  googleSpendPercentage: v.optional(v.number()),
  marketingPercentageOfGross: v.optional(v.number()),
  marketingPercentageOfNet: v.optional(v.number()),
  metaROAS: v.optional(v.number()),
  googleROAS: v.optional(v.number()),

  // Meta Detailed Metrics (monthly aggregates)
  metaImpressions: v.optional(v.number()),
  metaReach: v.optional(v.number()),
  metaFrequency: v.optional(v.number()),
  metaUniqueClicks: v.optional(v.number()),
  metaClicks: v.optional(v.number()),
  // Aggregated Meta purchases (click-to-purchase conversions)
  metaPurchases: v.optional(v.number()),
  metaCTR: v.optional(v.number()),
  metaCPC: v.optional(v.number()),
  metaCPM: v.optional(v.number()),
  metaCostPerConversion: v.optional(v.number()),
  metaAddToCart: v.optional(v.number()),
  metaInitiateCheckout: v.optional(v.number()),
  metaPageViews: v.optional(v.number()),
  metaViewContent: v.optional(v.number()),

  metaLinkClicks: v.optional(v.number()),
  metaOutboundClicks: v.optional(v.number()),
  metaLandingPageViews: v.optional(v.number()),
  metaVideoViews: v.optional(v.number()),
  metaVideo3SecViews: v.optional(v.number()),
  metaCostPerThruPlay: v.optional(v.number()),

  // Cost Structure Percentages
  cogsPercentageOfGross: v.optional(v.number()),
  cogsPercentageOfNet: v.optional(v.number()),
  shippingPercentageOfNet: v.optional(v.number()),
  taxesPercentageOfRevenue: v.optional(v.number()),
  handlingFeesPercentage: v.optional(v.number()),
  customCostsPercentage: v.optional(v.number()),
  discountRate: v.optional(v.number()),

  // Profitability Margins
  contributionMargin: v.optional(v.number()),
  contributionMarginPercentage: v.optional(v.number()),
  operatingMargin: v.optional(v.number()),

  // Customer Economics
  cacPercentageOfAOV: v.optional(v.number()),
  cacPaybackPeriod: v.optional(v.number()),

  // Unit Economics
  profitPerOrder: v.optional(v.number()),
  profitPerUnit: v.optional(v.number()),
  fulfillmentCostPerOrder: v.optional(v.number()),

  // Operational Efficiency
  inventoryTurnover: v.optional(v.number()),
  returnProcessingCost: v.optional(v.number()),

  // Existing Rates & Percentages
  cancelledOrderRate: v.optional(v.number()),
  returnRate: v.optional(v.number()),
  refundRate: v.optional(v.number()),

  // Growth Metrics
  moMRevenueGrowth: v.optional(v.number()),

  updatedAt: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_year_month", ["yearMonth"])
  .index("by_org_month", ["organizationId", "yearMonth"]);

// Real-time metrics for today (updated continuously)
// Removed legacy metricsRealtime table (use realtimeMetrics below)

// Product performance metrics
export const productMetrics = defineTable({
  organizationId: v.id("organizations"),
  productId: v.id("shopifyProducts"),
  date: v.string(), // YYYY-MM-DD

  // Sales metrics
  unitsSold: v.number(),
  revenue: v.number(),
  orders: v.number(),

  // Cost metrics
  cogs: v.number(),
  totalCost: v.number(),
  profit: v.number(),
  profitMargin: v.number(),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_product", ["productId"])
  .index("by_date", ["date"])
  .index("by_product_date", ["productId", "date"])
  .index("by_org_product_date", ["organizationId", "productId", "date"]);

// Customer lifetime value tracking
export const customerMetrics = defineTable({
  organizationId: v.id("organizations"),
  customerId: v.id("shopifyCustomers"),
  date: v.string(), // Date for time-series queries

  // Lifetime metrics
  firstOrderDate: v.string(),
  lastOrderDate: v.string(),

  // Value metrics
  lifetimeValue: v.number(),
  lifetimeOrders: v.number(),
  lifetimeProfit: v.number(),
  avgOrderValue: v.number(),

  // Frequency
  daysBetweenPurchases: v.optional(v.number()),

  // Attribution
  firstTouchChannel: v.optional(v.string()),
  lastTouchChannel: v.optional(v.string()),

  // Status
  isActive: v.boolean(),
  churnRisk: v.optional(v.string()), // low, medium, high

  // Segments
  segment: v.optional(v.union(v.literal("new"), v.literal("repeated"))),
  cohort: v.optional(v.string()), // acquisition month

  // Metadata
  calculatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_customer", ["customerId"])
  .index("by_segment", ["segment"])
  .index("by_cohort", ["cohort"])
  .index("by_ltv", ["lifetimeValue"]);

export const customerMetricsQueue = defineTable({
  organizationId: v.id("organizations"),
  customerId: v.id("shopifyCustomers"),
  enqueuedAt: v.number(),
  lastAttemptAt: v.optional(v.number()),
  attempts: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_customer", ["organizationId", "customerId"])
  .index("by_org_enqueued", ["organizationId", "enqueuedAt"]);

export const customerMetricsQueueState = defineTable({
  organizationId: v.id("organizations"),
  isProcessing: v.boolean(),
  scheduled: v.boolean(),
  lastScheduledAt: v.optional(v.number()),
  processingStartedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"]);

// Real-time dashboard metrics (cached)
export const realtimeMetrics = defineTable({
  organizationId: v.id("organizations"),
  metricType: v.string(), // revenue_today, orders_today, etc.

  // Values
  value: v.number(),
  previousValue: v.optional(v.number()),
  change: v.optional(v.number()),
  changePercent: v.optional(v.number()),

  // Time range
  period: v.string(), // today, yesterday, last7days, last30days

  // Metadata
  calculatedAt: v.number(),
  ttl: v.number(), // seconds until refresh needed
})
  .index("by_organization", ["organizationId"])
  .index("by_type", ["metricType"])
  .index("by_org_type", ["organizationId", "metricType"]);
