import { defineTable } from "convex/server";
import { v } from "convex/values";

// Unified cost table for all cost types
export const costs = defineTable({
  organizationId: v.id("organizations"),
  userId: v.optional(v.id("users")), // User who created this cost (optional for system-generated)

  // Type determines which UI tab this belongs to
  type: v.union(
    v.literal("product"), // Products tab - COGS
    v.literal("shipping"), // Shipping tab - shipping costs
    v.literal("payment"), // Payment Fees tab - transaction fees
    v.literal("operational"), // Other Expenses tab - operational costs
    v.literal("tax"), // Tax rates
    v.literal("handling"), // Handling fees
    v.literal("marketing"), // Marketing/advertising costs
  ),

  // Core fields
  name: v.string(),
  description: v.optional(v.string()),

  // Calculation method
  calculation: v.union(
    v.literal("fixed"), // Fixed amount per period/order
    v.literal("percentage"), // Percentage of revenue/order value
    v.literal("per_unit"), // Cost per unit/item
    v.literal("tiered"), // Volume-based tiers
    v.literal("weight_based"), // Based on weight (for shipping)
    v.literal("formula"), // Custom formula
  ),

  // Value configuration
  value: v.number(), // Base amount or percentage

  // Frequency for fixed costs
  frequency: v.optional(
    v.union(
      v.literal("one_time"),
      v.literal("per_order"),
      v.literal("per_item"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly"),
      v.literal("percentage"),
    ),
  ),

  // Status
  isActive: v.boolean(),
  isDefault: v.boolean(),

  // Effective dates
  effectiveFrom: v.number(),
  effectiveTo: v.optional(v.number()),

  // Metadata
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_and_type", ["organizationId", "type"])
  .index("by_org_type_name", ["organizationId", "type", "name"])
  .index("by_org_type_and_active", ["organizationId", "type", "isActive"])
  .index("by_org_type_default", ["organizationId", "type", "isDefault"])
  .index("by_org_type_frequency", ["organizationId", "type", "frequency"])
  .index("by_org_and_active", ["organizationId", "isActive"])
  .index("by_type", ["type"])
  .index("by_effective_from", ["effectiveFrom"]);

// Cost categories for grouping and organization
export const costCategories = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"),

  // Category info
  name: v.string(),

  // Type mapping
  costType: v.union(
    v.literal("product"),
    v.literal("shipping"),
    v.literal("payment"),
    v.literal("operational"),
    v.literal("tax"),
    v.literal("handling"),
    v.literal("marketing"),
  ),

  // Status
  isActive: v.boolean(),
  isDefault: v.boolean(),

  // Metadata
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_active", ["organizationId", "isActive"])
  .index("by_type", ["costType"]);

// Per-variant product-level cost components
export const productCostComponents = defineTable({
  organizationId: v.id("organizations"),
  userId: v.optional(v.id("users")), // Optional for system-generated,
  variantId: v.id("shopifyProductVariants"),

  // Per-unit components
  cogsPerUnit: v.optional(v.number()),
  shippingPerUnit: v.optional(v.number()),
  handlingPerUnit: v.optional(v.number()),
  // Per-variant tax percent
  taxPercent: v.optional(v.number()),

  // Payment fee overrides at product level
  paymentFeePercent: v.optional(v.number()),
  paymentFixedPerItem: v.optional(v.number()),
  paymentProvider: v.optional(v.string()),

  // Lifecycle
  isActive: v.boolean(),
  effectiveFrom: v.number(),
  effectiveTo: v.optional(v.number()),

  // Metadata
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_variant", ["variantId"])
  .index("by_org_variant", ["organizationId", "variantId"]) 
  .index("by_org_and_active", ["organizationId", "isActive"]) 
  .index("by_variant_and_active", ["variantId", "isActive"]) 
  .index("by_effective_from", ["effectiveFrom"]);
