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
  uniqueCustomers: v.optional(v.number()),
  cogs: v.optional(v.number()),
  shippingCost: v.optional(v.number()),
  handlingFee: v.optional(v.number()),
  operatingCost: v.optional(v.number()),
  blendedRoas: v.optional(v.number()),
  blendedConversionRate: v.optional(v.number()),
  blendedCtr: v.optional(v.number()),
  blendedCac: v.optional(v.number()),
  blendedMarketingCost: v.optional(v.number()),

  paymentBreakdown: v.optional(paymentBreakdown),
  customerBreakdown: v.optional(customerBreakdown),
}).index("by_organization_date", ["organizationId", "date"]);
