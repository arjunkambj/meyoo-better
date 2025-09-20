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
  taxesPaid: v.number(),

  // 3. Order Summary
  avgOrderValue: v.number(),
  avgOrderCost: v.number(),
  avgOrderProfit: v.number(),
  adSpendPerOrder: v.number(),
  purchaseFrequency: v.number(),

  // 4. Customer Summary
  totalCustomers: v.number(),
  newCustomers: v.number(),
  returningCustomers: v.number(),
  repeatCustomerRate: v.optional(v.number()),
  customerAcquisitionCost: v.number(),
  customerLifetimeValue: v.optional(v.number()),
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
  totalSessions: v.optional(v.number()), // Total website sessions
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
  marketingEfficiencyRatio: v.optional(v.number()),
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
  metaVideoThruPlay: v.optional(v.number()),
  metaCostPerThruPlay: v.optional(v.number()),
  metaQualityRanking: v.optional(v.number()),
  metaEngagementRateRanking: v.optional(v.number()),
  metaConversionRateRanking: v.optional(v.number()),

  // 8. Cost Structure Percentages
  cogsPercentageOfGross: v.optional(v.number()),
  cogsPercentageOfNet: v.optional(v.number()),
  shippingPercentageOfGross: v.optional(v.number()),
  shippingPercentageOfNet: v.optional(v.number()),
  transactionFeesPercentage: v.optional(v.number()),
  taxesPercentageOfRevenue: v.optional(v.number()),
  handlingFeesPercentage: v.optional(v.number()),
  customCostsPercentage: v.optional(v.number()),
  discountRate: v.optional(v.number()),
  operatingExpenseRatio: v.optional(v.number()),

  // 9. Profitability Margins
  contributionMargin: v.optional(v.number()),
  contributionMarginPercentage: v.optional(v.number()),
  operatingMargin: v.optional(v.number()),
  ebitdaMargin: v.optional(v.number()),

  // 10. Customer Economics
  cacPercentageOfAOV: v.optional(v.number()),
  cacPercentageOfFirstOrder: v.optional(v.number()),
  cacPaybackPeriod: v.optional(v.number()),
  customerRetentionCost: v.optional(v.number()),
  revenuePerCustomer: v.optional(v.number()),
  ordersPerCustomer: v.optional(v.number()),
  profitPerCustomer: v.optional(v.number()),

  // 11. Unit Economics
  profitPerOrder: v.optional(v.number()),
  profitPerUnit: v.optional(v.number()),
  costPerOrder: v.optional(v.number()),
  marketingCostPerOrder: v.optional(v.number()),
  fulfillmentCostPerOrder: v.optional(v.number()),

  // 12. Operational Efficiency
  inventoryTurnover: v.optional(v.number()),
  cashConversionCycle: v.optional(v.number()),
  operatingLeverage: v.optional(v.number()),
  returnProcessingCost: v.optional(v.number()),
  wastePercentage: v.optional(v.number()),

  // 13. Existing Rates & Percentages
  cancelledOrderRate: v.optional(v.number()),
  returnRate: v.optional(v.number()),
  refundRate: v.optional(v.number()),
  expenseToRevenueRatio: v.optional(v.number()),

  // 14. Growth Metrics
  moMRevenueGrowth: v.optional(v.number()),
  yoYRevenueGrowth: v.optional(v.number()),
  retentionRate: v.optional(v.number()),

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
  taxesPaid: v.number(),

  avgOrderValue: v.number(),
  avgOrderCost: v.number(),
  avgOrderProfit: v.number(),
  adSpendPerOrder: v.number(),
  purchaseFrequency: v.number(),

  totalCustomers: v.number(),
  newCustomers: v.number(),
  returningCustomers: v.number(),
  repeatCustomerRate: v.optional(v.number()),
  repurchaseRate: v.optional(v.number()),
  customerAcquisitionCost: v.number(),
  customerLifetimeValue: v.optional(v.number()),
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
  marketingEfficiencyRatio: v.optional(v.number()),
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
  metaVideoThruPlay: v.optional(v.number()),
  metaCostPerThruPlay: v.optional(v.number()),
  metaQualityRanking: v.optional(v.number()),
  metaEngagementRateRanking: v.optional(v.number()),
  metaConversionRateRanking: v.optional(v.number()),

  // Cost Structure Percentages
  cogsPercentageOfGross: v.optional(v.number()),
  cogsPercentageOfNet: v.optional(v.number()),
  shippingPercentageOfGross: v.optional(v.number()),
  shippingPercentageOfNet: v.optional(v.number()),
  transactionFeesPercentage: v.optional(v.number()),
  taxesPercentageOfRevenue: v.optional(v.number()),
  handlingFeesPercentage: v.optional(v.number()),
  customCostsPercentage: v.optional(v.number()),
  discountRate: v.optional(v.number()),
  operatingExpenseRatio: v.optional(v.number()),

  // Profitability Margins
  contributionMargin: v.optional(v.number()),
  contributionMarginPercentage: v.optional(v.number()),
  operatingMargin: v.optional(v.number()),
  ebitdaMargin: v.optional(v.number()),

  // Customer Economics
  cacPercentageOfAOV: v.optional(v.number()),
  cacPercentageOfFirstOrder: v.optional(v.number()),
  cacPaybackPeriod: v.optional(v.number()),
  customerRetentionCost: v.optional(v.number()),
  revenuePerCustomer: v.optional(v.number()),
  ordersPerCustomer: v.optional(v.number()),
  profitPerCustomer: v.optional(v.number()),

  // Unit Economics
  profitPerOrder: v.optional(v.number()),
  profitPerUnit: v.optional(v.number()),
  costPerOrder: v.optional(v.number()),
  marketingCostPerOrder: v.optional(v.number()),
  fulfillmentCostPerOrder: v.optional(v.number()),

  // Operational Efficiency
  inventoryTurnover: v.optional(v.number()),
  cashConversionCycle: v.optional(v.number()),
  operatingLeverage: v.optional(v.number()),
  returnProcessingCost: v.optional(v.number()),
  wastePercentage: v.optional(v.number()),

  // Existing Rates & Percentages
  cancelledOrderRate: v.optional(v.number()),
  returnRate: v.optional(v.number()),
  refundRate: v.optional(v.number()),
  expenseToRevenueRatio: v.optional(v.number()),

  // Growth Metrics
  moMRevenueGrowth: v.optional(v.number()),
  yoYRevenueGrowth: v.optional(v.number()),
  retentionRate: v.optional(v.number()),

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
  taxesPaid: v.number(),

  avgOrderValue: v.number(),
  avgOrderCost: v.number(),
  avgOrderProfit: v.number(),
  adSpendPerOrder: v.number(),
  purchaseFrequency: v.number(),

  totalCustomers: v.number(),
  newCustomers: v.number(),
  returningCustomers: v.number(),
  repeatCustomerRate: v.optional(v.number()),
  repurchaseRate: v.optional(v.number()),
  customerAcquisitionCost: v.number(),
  customerLifetimeValue: v.optional(v.number()),
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
  marketingEfficiencyRatio: v.optional(v.number()),
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
  metaVideoThruPlay: v.optional(v.number()),
  metaCostPerThruPlay: v.optional(v.number()),
  metaQualityRanking: v.optional(v.number()),
  metaEngagementRateRanking: v.optional(v.number()),
  metaConversionRateRanking: v.optional(v.number()),

  // Cost Structure Percentages
  cogsPercentageOfGross: v.optional(v.number()),
  cogsPercentageOfNet: v.optional(v.number()),
  shippingPercentageOfGross: v.optional(v.number()),
  shippingPercentageOfNet: v.optional(v.number()),
  transactionFeesPercentage: v.optional(v.number()),
  taxesPercentageOfRevenue: v.optional(v.number()),
  handlingFeesPercentage: v.optional(v.number()),
  customCostsPercentage: v.optional(v.number()),
  discountRate: v.optional(v.number()),
  operatingExpenseRatio: v.optional(v.number()),

  // Profitability Margins
  contributionMargin: v.optional(v.number()),
  contributionMarginPercentage: v.optional(v.number()),
  operatingMargin: v.optional(v.number()),
  ebitdaMargin: v.optional(v.number()),

  // Customer Economics
  cacPercentageOfAOV: v.optional(v.number()),
  cacPercentageOfFirstOrder: v.optional(v.number()),
  cacPaybackPeriod: v.optional(v.number()),
  customerRetentionCost: v.optional(v.number()),
  revenuePerCustomer: v.optional(v.number()),
  ordersPerCustomer: v.optional(v.number()),
  profitPerCustomer: v.optional(v.number()),

  // Unit Economics
  profitPerOrder: v.optional(v.number()),
  profitPerUnit: v.optional(v.number()),
  costPerOrder: v.optional(v.number()),
  marketingCostPerOrder: v.optional(v.number()),
  fulfillmentCostPerOrder: v.optional(v.number()),

  // Operational Efficiency
  inventoryTurnover: v.optional(v.number()),
  cashConversionCycle: v.optional(v.number()),
  operatingLeverage: v.optional(v.number()),
  returnProcessingCost: v.optional(v.number()),
  wastePercentage: v.optional(v.number()),

  // Existing Rates & Percentages
  cancelledOrderRate: v.optional(v.number()),
  returnRate: v.optional(v.number()),
  refundRate: v.optional(v.number()),
  expenseToRevenueRatio: v.optional(v.number()),

  // Growth Metrics
  moMRevenueGrowth: v.optional(v.number()),
  yoYRevenueGrowth: v.optional(v.number()),
  retentionRate: v.optional(v.number()),

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

  // Inventory
  startingInventory: v.optional(v.number()),
  endingInventory: v.optional(v.number()),

  // Returns
  unitsReturned: v.optional(v.number()),
  returnRate: v.optional(v.number()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_product", ["productId"])
  .index("by_date", ["date"])
  .index("by_product_date", ["productId", "date"])
  .index("by_org_product_date", ["organizationId", "productId", "date"]);

// Channel performance (based on UTM)
export const channelMetrics = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(), // YYYY-MM-DD

  // Channel info
  channel: v.string(), // meta, google, organic, email, etc.
  source: v.optional(v.string()),
  medium: v.optional(v.string()),
  campaign: v.optional(v.string()),

  // Performance
  orders: v.number(),
  revenue: v.number(),
  adSpend: v.number(),
  profit: v.number(),
  roas: v.number(),

  // Traffic
  sessions: v.optional(v.number()),
  visitors: v.optional(v.number()),
  conversionRate: v.optional(v.number()),

  // Customer metrics
  newCustomers: v.optional(v.number()),
  cac: v.optional(v.number()),

  // Platform-specific metrics (for Meta and Google)
  clicks: v.optional(v.number()),
  impressions: v.optional(v.number()),
  purchases: v.optional(v.number()),

  // Meta-specific
  leads: v.optional(v.number()),
  leadValue: v.optional(v.number()),
  costPerLead: v.optional(v.number()),
  videoViews: v.optional(v.number()),
  linkClicks: v.optional(v.number()),
  viewContent: v.optional(v.number()),
  completeRegistration: v.optional(v.number()),

  // Google-specific
  shoppingSales: v.optional(v.number()),
  shoppingUnits: v.optional(v.number()),
  videoViewRate: v.optional(v.number()),
  searchImpressionShare: v.optional(v.number()),
  searchTopImpressionShare: v.optional(v.number()),
  allConversions: v.optional(v.number()),
  allConversionsValue: v.optional(v.number()),
  viewThroughConversions: v.optional(v.number()),

  // Quality scores (both platforms)
  averageQualityScore: v.optional(v.number()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_date", ["date"])
  .index("by_channel", ["channel"])
  .index("by_channel_date", ["channel", "date"])
  .index("by_org_channel_date", ["organizationId", "channel", "date"])
  .index("by_source_medium", ["source", "medium"]);

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
  purchaseFrequency: v.number(), // orders per month
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

// Dashboard widget configurations for different metric views
export const metricWidgets = defineTable({
  organizationId: v.id("organizations"),
  dashboardId: v.id("dashboards"),

  // Widget info
  widgetId: v.string(),
  title: v.string(),
  description: v.optional(v.string()),

  // Metric configuration
  metricType: v.string(), // e.g., "revenue", "orders", "profit", etc.
  metricCategory: v.union(
    v.literal("general"),
    v.literal("costs"),
    v.literal("orders"),
    v.literal("customers"),
    v.literal("others"),
    v.literal("adspend"),
  ),

  // View type
  viewType: v.union(
    v.literal("normal"), // Just the number
    v.literal("chart"), // With visualization
  ),

  // Chart configuration (if viewType is "chart")
  chartConfig: v.optional(
    v.object({
      type: v.union(
        v.literal("line"),
        v.literal("bar"),
        v.literal("area"),
        v.literal("pie"),
        v.literal("donut"),
        v.literal("sparkline"),
      ),
      timeRange: v.string(), // "7d", "30d", "3m", "1y", etc.
      comparison: v.optional(v.boolean()), // Compare with previous period
      groupBy: v.optional(v.string()), // "day", "week", "month"
    }),
  ),

  // Display settings
  position: v.object({ x: v.number(), y: v.number() }),
  size: v.object({ w: v.number(), h: v.number() }),
  color: v.optional(v.string()),

  // Metadata
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_dashboard", ["dashboardId"])
  .index("by_category", ["metricCategory"]);

// Metric view preferences (normal vs chart) per user
export const metricViewPreferences = defineTable({
  userId: v.id("users"),
  organizationId: v.id("organizations"),

  // Default view preferences by category
  preferences: v.object({
    general: v.union(v.literal("normal"), v.literal("chart")),
    costs: v.union(v.literal("normal"), v.literal("chart")),
    orders: v.union(v.literal("normal"), v.literal("chart")),
    customers: v.union(v.literal("normal"), v.literal("chart")),
    others: v.union(v.literal("normal"), v.literal("chart")),
    adspend: v.union(v.literal("normal"), v.literal("chart")),
  }),

  // Chart defaults
  defaultChartType: v.optional(v.string()),
  defaultTimeRange: v.optional(v.string()),

  // Metadata
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_org_user", ["organizationId", "userId"])
  .index("by_organization", ["organizationId"]);

// RFM (Recency, Frequency, Monetary) segmentation
export const rfmSegments = defineTable({
  organizationId: v.id("organizations"),
  customerId: v.id("shopifyCustomers"),

  // RFM scores (1-5 scale)
  recencyScore: v.number(), // Days since last purchase
  frequencyScore: v.number(), // Number of purchases
  monetaryScore: v.number(), // Total spend

  // Combined RFM score
  rfmScore: v.string(), // e.g., "555" for champions

  // Segment classification
  segment: v.union(v.literal("new"), v.literal("repeated")),

  // Raw values
  daysSinceLastOrder: v.number(),
  orderCount: v.number(),
  totalSpent: v.number(),

  // Segment transition
  previousSegment: v.optional(v.string()),
  segmentChangedAt: v.optional(v.number()),

  // Recommendations
  recommendedActions: v.optional(v.array(v.string())),

  // Metadata
  calculatedAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_customer", ["customerId"])
  .index("by_segment", ["segment"])
  .index("by_score", ["rfmScore"])
  .index("by_org_segment", ["organizationId", "segment"]);

// Cohort analysis for retention tracking
export const cohortAnalysis = defineTable({
  organizationId: v.id("organizations"),

  // Cohort definition
  cohortMonth: v.string(), // YYYY-MM
  cohortType: v.union(
    v.literal("acquisition"), // First purchase
    v.literal("channel"), // By acquisition channel
    v.literal("product"), // By first product purchased
    v.literal("campaign"), // By campaign
  ),
  cohortValue: v.optional(v.string()), // Channel name, product ID, etc.

  // Cohort metrics
  cohortSize: v.number(), // Initial customers

  // Retention by period (percentage)
  month0: v.number(), // 100% by definition
  month1: v.optional(v.number()),
  month2: v.optional(v.number()),
  month3: v.optional(v.number()),
  month4: v.optional(v.number()),
  month5: v.optional(v.number()),
  month6: v.optional(v.number()),
  month9: v.optional(v.number()),
  month12: v.optional(v.number()),
  month18: v.optional(v.number()),
  month24: v.optional(v.number()),

  // Revenue retention
  revenueMonth0: v.number(),
  revenueMonth1: v.optional(v.number()),
  revenueMonth3: v.optional(v.number()),
  revenueMonth6: v.optional(v.number()),
  revenueMonth12: v.optional(v.number()),

  // Average metrics
  avgOrderValue: v.number(),
  avgOrdersPerCustomer: v.number(),
  avgLTV: v.number(),

  // Metadata
  lastCalculated: v.string(),
})
  .index("by_organization", ["organizationId"])
  .index("by_cohort", ["cohortMonth"])
  .index("by_type", ["cohortType"])
  .index("by_org_month", ["organizationId", "cohortMonth"]);

// Product profitability analysis
export const productProfitability = defineTable({
  organizationId: v.id("organizations"),
  productId: v.id("shopifyProducts"),
  variantId: v.optional(v.id("shopifyProductVariants")),
  date: v.string(), // YYYY-MM-DD

  // Revenue metrics
  revenue: v.number(),
  unitsSold: v.number(),
  avgSellingPrice: v.number(),

  // Cost breakdown
  cogs: v.number(),
  shippingCost: v.number(),
  transactionFees: v.number(),
  marketingCost: v.number(), // Allocated from campaigns
  returnCost: v.number(),
  handlingCost: v.number(),

  // Profitability metrics
  contributionMargin: v.number(), // Revenue - Variable costs
  contributionMarginPercent: v.number(),
  netProfit: v.number(),
  netProfitMargin: v.number(),

  // Performance metrics
  sellThroughRate: v.optional(v.number()),
  returnRate: v.optional(v.number()),

  // ABC classification
  abcCategory: v.optional(
    v.union(
      v.literal("A"), // Top 20% revenue
      v.literal("B"), // Next 30% revenue
      v.literal("C"), // Bottom 50% revenue
    ),
  ),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_product", ["productId"])
  .index("by_date", ["date"])
  .index("by_product_date", ["productId", "date"])
  .index("by_abc", ["abcCategory"])
  .index("by_margin", ["contributionMarginPercent"]);

// Inventory metrics and analysis
export const inventoryMetrics = defineTable({
  organizationId: v.id("organizations"),
  productId: v.id("shopifyProducts"),
  variantId: v.id("shopifyProductVariants"),
  date: v.string(), // YYYY-MM-DD

  // Stock levels
  openingStock: v.number(),
  closingStock: v.number(),
  avgStock: v.number(),

  // Movement
  unitsSold: v.number(),
  unitsReceived: v.number(),
  unitsReturned: v.number(),
  unitsAdjusted: v.number(),

  // Turnover metrics
  stockTurnoverRate: v.number(), // COGS / Avg inventory
  daysInventoryOutstanding: v.number(), // 365 / turnover

  // Stock health
  stockoutDays: v.number(),
  overstockDays: v.number(),

  // Financial metrics
  inventoryValue: v.number(),
  carryingCost: v.number(),

  // Forecasting
  reorderPoint: v.optional(v.number()),
  safetyStock: v.optional(v.number()),
  economicOrderQuantity: v.optional(v.number()),

  // Classification
  stockStatus: v.union(
    v.literal("healthy"),
    v.literal("low"),
    v.literal("critical"),
    v.literal("overstock"),
    v.literal("dead"),
  ),

  // Metadata
  calculatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_product", ["productId"])
  .index("by_variant", ["variantId"])
  .index("by_date", ["date"])
  .index("by_status", ["stockStatus"])
  .index("by_turnover", ["stockTurnoverRate"]);

// Return analytics
export const returnAnalytics = defineTable({
  organizationId: v.id("organizations"),
  orderId: v.id("shopifyOrders"),
  customerId: v.id("shopifyCustomers"),

  // Return details
  returnDate: v.string(),
  returnReason: v.string(),
  returnType: v.union(
    v.literal("refund"),
    v.literal("exchange"),
    v.literal("store_credit"),
  ),

  // Items returned
  items: v.array(
    v.object({
      productId: v.id("shopifyProducts"),
      variantId: v.id("shopifyProductVariants"),
      quantity: v.number(),
      reason: v.string(),
    }),
  ),

  // Financial impact
  returnValue: v.number(),
  refundAmount: v.number(),
  restockingFee: v.optional(v.number()),
  returnShippingCost: v.number(),

  // Processing
  processingTime: v.number(), // Days
  inspectionResult: v.optional(v.string()),

  // Customer behavior
  isSerialReturner: v.boolean(),
  customerReturnRate: v.number(),

  // Metadata
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_customer", ["customerId"])
  .index("by_date", ["returnDate"])
  .index("by_reason", ["returnReason"])
  .index("by_serial_returner", ["isSerialReturner"]);

// Geographic performance metrics
export const geographicMetrics = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(), // YYYY-MM-DD

  // Location
  country: v.string(),
  region: v.optional(v.string()), // State/Province
  city: v.optional(v.string()),
  postalCode: v.optional(v.string()),

  // Performance metrics
  orders: v.number(),
  revenue: v.number(),
  avgOrderValue: v.number(),

  // Costs
  shippingCost: v.number(),
  taxCollected: v.number(),

  // Profitability
  profit: v.number(),
  profitMargin: v.number(),

  // Customer metrics
  uniqueCustomers: v.number(),
  newCustomers: v.number(),
  repeatCustomers: v.number(),

  // Market metrics
  marketPenetration: v.optional(v.number()),
  marketShare: v.optional(v.number()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_date", ["date"])
  .index("by_country", ["country"])
  .index("by_region", ["country", "region"])
  .index("by_revenue", ["revenue"]);

// Predictive analytics and ML models
export const predictiveMetrics = defineTable({
  organizationId: v.id("organizations"),

  // Model type
  modelType: v.union(
    v.literal("sales_forecast"),
    v.literal("demand_forecast"),
    v.literal("clv_prediction"),
    v.literal("churn_prediction"),
    v.literal("price_elasticity"),
    v.literal("inventory_forecast"),
  ),

  // Target entity
  entityType: v.optional(v.string()), // product, customer, etc.
  entityId: v.optional(v.string()),

  // Prediction period
  predictionDate: v.string(),
  predictionHorizon: v.number(), // Days ahead

  // Predictions
  predictedValue: v.number(),
  confidenceInterval: v.object({
    lower: v.number(),
    upper: v.number(),
  }),
  probability: v.optional(v.number()), // For classification

  // Model performance
  modelAccuracy: v.optional(v.number()),
  lastTrainedAt: v.number(),

  // Feature importance
  topFactors: v.optional(
    v.array(
      v.object({
        factor: v.string(),
        importance: v.number(),
      }),
    ),
  ),

  // Recommendations
  recommendations: v.optional(v.array(v.string())),

  // Metadata
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_model", ["modelType"])
  .index("by_entity", ["entityType", "entityId"])
  .index("by_date", ["predictionDate"]);

// Market basket analysis
export const marketBasketAnalysis = defineTable({
  organizationId: v.id("organizations"),

  // Product association
  productA: v.id("shopifyProducts"),
  productB: v.id("shopifyProducts"),

  // Association metrics
  support: v.number(), // Frequency of co-occurrence
  confidence: v.number(), // P(B|A)
  lift: v.number(), // Confidence / P(B)

  // Performance when bundled
  bundleRevenue: v.optional(v.number()),
  bundleProfit: v.optional(v.number()),
  bundleConversionRate: v.optional(v.number()),

  // Time period
  analysisDate: v.string(),
  periodDays: v.number(),

  // Metadata
  lastCalculated: v.string(),
})
  .index("by_organization", ["organizationId"])
  .index("by_product_a", ["productA"])
  .index("by_product_b", ["productB"])
  .index("by_lift", ["lift"])
  .index("by_confidence", ["confidence"]);

// Customer journey analytics
export const customerJourneyMetrics = defineTable({
  organizationId: v.id("organizations"),
  customerId: v.id("shopifyCustomers"),

  // Journey summary
  firstTouchpoint: v.string(),
  lastTouchpoint: v.string(),
  totalTouchpoints: v.number(),

  // Touchpoint sequence
  touchpoints: v.array(
    v.object({
      channel: v.string(),
      medium: v.string(),
      campaign: v.optional(v.string()),
      timestamp: v.string(),
      action: v.string(), // view, click, add_to_cart, purchase
    }),
  ),

  // Attribution
  firstTouchRevenue: v.number(),
  lastTouchRevenue: v.number(),
  linearRevenue: v.number(),
  timeDecayRevenue: v.number(),
  dataDriverRevenue: v.optional(v.number()),

  // Journey metrics
  daysToConversion: v.number(),
  pathLength: v.number(),

  // Channel mix
  channelExposure: v.object({
    organic: v.optional(v.number()),
    paid_search: v.optional(v.number()),
    paid_social: v.optional(v.number()),
    email: v.optional(v.number()),
    direct: v.optional(v.number()),
    referral: v.optional(v.number()),
  }),

  // Metadata
  journeyStart: v.string(),
  journeyEnd: v.string(),
  lastUpdated: v.string(),
})
  .index("by_organization", ["organizationId"])
  .index("by_customer", ["customerId"])
  .index("by_first_touch", ["firstTouchpoint"])
  .index("by_path_length", ["pathLength"]);
