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
