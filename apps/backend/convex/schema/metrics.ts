import { defineTable } from "convex/server";
import { v } from "convex/values";

const paymentBreakdown = v.object({
  prepaidOrders: v.optional(v.number()),
  codOrders: v.optional(v.number()),
  otherOrders: v.optional(v.number()),
});

const customerBreakdown = v.object({
  newCustomers: v.optional(v.number()),
  returningCustomers: v.optional(v.number()),
  repeatCustomers: v.optional(v.number()),
});

// NOTE: These snapshots are owned by the analytics engine.
// Webhooks should enqueue a rebuild job instead of recalculating them inline.
export const dailyMetrics = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(), // YYYY-MM-DD

  totalOrders: v.optional(v.number()),
  totalRevenue: v.optional(v.number()),
  totalDiscounts: v.optional(v.number()),
  grossSales: v.optional(v.number()),
  paidCustomers: v.optional(v.number()), // Customers who PURCHASED (paid customers)
  totalCustomers: v.optional(v.number()), // ALL customers in system (purchased + didn't purchase)
  unitsSold: v.optional(v.number()), // Total units sold that day
  totalCogs: v.optional(v.number()),
  totalHandlingFee: v.optional(v.number()),
  totalShippingCost: v.optional(v.number()),
  totalTransactionFees: v.optional(v.number()),
  totalTaxes: v.optional(v.number()),
  blendedRoas: v.optional(v.number()),
  blendedCtr: v.optional(v.number()),
  blendedMarketingCost: v.optional(v.number()),
  cancelledOrders: v.optional(v.number()),
  returnedOrders: v.optional(v.number()),

  // Session and analytics data
  sessions: v.optional(v.number()),
  visitors: v.optional(v.number()),
  conversions: v.optional(v.number()),

  paymentBreakdown: v.optional(paymentBreakdown),
  customerBreakdown: v.optional(customerBreakdown),
  channelRevenue: v.optional(
    v.array(
      v.object({
        name: v.string(),
        revenue: v.number(),
        orders: v.number(),
      }),
    ),
  ),
})
  .index("by_organization_date", ["organizationId", "date"])
  .index("by_organization", ["organizationId"]);

// Short-lived locks to debounce analytics rebuild scheduling
export const analyticsRebuildLocks = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(),
  lockedUntil: v.number(),
  lastScope: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org_date", ["organizationId", "date"])
  .index("by_locked_until", ["lockedUntil"]);

const inventoryVariantSummary = v.object({
  id: v.string(),
  sku: v.optional(v.string()),
  title: v.optional(v.string()),
  price: v.number(),
  stock: v.number(),
  available: v.number(),
  unitsSold: v.optional(v.number()),
});

export const inventoryProductSummaries = defineTable({
  organizationId: v.id("organizations"),
  productId: v.id("shopifyProducts"),
  computedAt: v.number(),
  name: v.string(),
  sku: v.string(),
  image: v.optional(v.string()),
  category: v.string(),
  vendor: v.string(),
  stock: v.number(),
  available: v.number(),
  reorderPoint: v.number(),
  stockStatus: v.union(
    v.literal("healthy"),
    v.literal("low"),
    v.literal("critical"),
    v.literal("out"),
  ),
  price: v.number(),
  cost: v.number(),
  margin: v.number(),
  unitsSold: v.optional(v.number()),
  periodRevenue: v.optional(v.number()),
  lastSoldAt: v.optional(v.number()),
  abcCategory: v.union(v.literal("A"), v.literal("B"), v.literal("C")),
  variantCount: v.number(),
  variants: v.optional(v.array(inventoryVariantSummary)),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_computed", ["organizationId", "computedAt"])
  .index("by_org_product", ["organizationId", "productId"]);

export const inventoryOverviewSummaries = defineTable({
  organizationId: v.id("organizations"),
  computedAt: v.number(),
  analysisWindowDays: v.number(),
  totalValue: v.number(),
  totalCogs: v.number(),
  totalSkus: v.number(),
  stockCoverageDays: v.number(),
  deadStock: v.number(),
  totalUnitsInStock: v.number(),
  totalUnitsSold: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_computed", ["organizationId", "computedAt"]);

const customerStatus = v.union(
  v.literal("converted"),
  v.literal("abandoned_cart"),
);

export const customerMetricsSummaries = defineTable({
  organizationId: v.id("organizations"),
  customerId: v.id("shopifyCustomers"),
  computedAt: v.number(),
  analysisWindowDays: v.number(),
  name: v.string(),
  email: v.optional(v.string()),
  status: customerStatus,
  segment: v.string(),
  lifetimeOrders: v.number(),
  lifetimeValue: v.number(),
  avgOrderValue: v.number(),
  periodOrders: v.number(),
  periodRevenue: v.number(),
  firstOrderAt: v.optional(v.number()),
  lastOrderAt: v.optional(v.number()),
  shopifyCreatedAt: v.number(),
  shopifyUpdatedAt: v.optional(v.number()),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  isReturning: v.boolean(),
  searchName: v.string(),
  searchEmail: v.optional(v.string()),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_computed", ["organizationId", "computedAt"])
  .index("by_org_customer", ["organizationId", "customerId"]);

export const customerOverviewSummaries = defineTable({
  organizationId: v.id("organizations"),
  computedAt: v.number(),
  analysisWindowDays: v.number(),
  windowStartMs: v.optional(v.number()),
  windowEndMsExclusive: v.optional(v.number()),
  totalCustomers: v.number(),
  convertedCustomers: v.number(),
  abandonedCustomers: v.number(),
  returningCustomers: v.number(),
  newCustomers: v.number(),
  activeCustomers: v.number(),
  periodOrders: v.number(),
  periodRevenue: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_computed", ["organizationId", "computedAt"]);

export const customerDailyActivities = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(),
  customerKey: v.string(),
  orders: v.number(),
  prepaidOrders: v.optional(v.number()),
  revenue: v.optional(v.number()),
  lifetimeOrders: v.optional(v.number()),
  customerCreatedAt: v.optional(v.number()),
})
  .index("by_org_date", ["organizationId", "date"])
  .index("by_org_customer", ["organizationId", "customerKey"]);

export const customerDailySummaries = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(),
  customersCreated: v.number(),
  totalCustomers: v.number(),
})
  .index("by_org_date", ["organizationId", "date"]);
