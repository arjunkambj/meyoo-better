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
  abandonedCustomers: v.optional(v.number()),
});

export const dailyMetrics = defineTable({
  organizationId: v.id("organizations"),
  date: v.string(), // YYYY-MM-DD

  totalOrders: v.optional(v.number()),
  totalRevenue: v.optional(v.number()),
  uniqueCustomers: v.optional(v.number()), // Customers who PURCHASED (paid customers)
  totalCustomers: v.optional(v.number()), // ALL customers in system (purchased + didn't purchase)
  unitsSold: v.optional(v.number()), // Total units sold that day
  totalCogs: v.optional(v.number()),
  totalHandlingFee: v.optional(v.number()),
  totalShippingCost: v.optional(v.number()),
  totalTransactionFees: v.optional(v.number()),
  totalMarketingCost: v.optional(v.number()),
  dailyOperatingCost: v.optional(v.number()),
  totalTaxes: v.optional(v.number()),
  blendedRoas: v.optional(v.number()),
  blendedCtr: v.optional(v.number()),
  blendedMarketingCost: v.optional(v.number()),
  cancelledOrders: v.optional(v.number()),
  returnedOrders: v.optional(v.number()),

  paymentBreakdown: v.optional(paymentBreakdown),
  customerBreakdown: v.optional(customerBreakdown),
})
  .index("by_organization_date", ["organizationId", "date"])
  .index("by_organization", ["organizationId"]);
