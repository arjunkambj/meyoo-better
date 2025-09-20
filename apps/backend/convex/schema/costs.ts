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

  // Advanced configuration (JSON for flexibility)
  config: v.optional(v.any()), // Store complex configs like tiers, weight ranges, etc.

  // Provider info (for payment fees, shipping, etc.)
  provider: v.optional(v.string()), // Stripe, PayPal, FedEx, etc.
  providerType: v.optional(v.string()), // payment_processor, carrier, etc.

  // Application scope
  applyTo: v.optional(
    v.union(
      v.literal("all"),
      v.literal("specific_products"),
      v.literal("specific_categories"),
      v.literal("specific_orders"),
      v.literal("specific_channels"),
    ),
  ),
  applyToIds: v.optional(v.array(v.string())), // IDs of products/categories/etc.

  // Status and priority
  isActive: v.boolean(),
  isDefault: v.boolean(),
  priority: v.number(), // For determining which cost to apply when multiple match

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
  .index("by_org_and_active", ["organizationId", "isActive"])
  .index("by_type", ["type"])
  .index("by_priority", ["priority"])
  .index("by_effective_from", ["effectiveFrom"])
  .index("by_provider", ["provider"])
  .index("by_org_type_and_effective", [
    "organizationId",
    "type",
    "effectiveFrom",
  ]);

// Cost categories for grouping and organization
export const costCategories = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"),

  // Category info
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),

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

  // Hierarchy
  parentId: v.optional(v.id("costCategories")),

  // Budget tracking
  monthlyBudget: v.optional(v.number()),
  yearlyBudget: v.optional(v.number()),

  // Status
  isActive: v.boolean(),
  isDefault: v.boolean(),

  // Metadata
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_active", ["organizationId", "isActive"])
  .index("by_type", ["costType"])
  .index("by_parent", ["parentId"]);

// Track actual cost allocations
// costAllocations table removed (unused)

// DEPRECATED: Historical cost defaults for initial setup
// Kept for backwards-compatibility/migrations. Do not write new data here.
// Single source of truth is the `costs` table (global) and `productCostComponents` (per-variant).
export const historicalCostDefaults = defineTable({
  organizationId: v.id("organizations"),

  // Average costs for historical/onboarding defaults
  cogsPercent: v.optional(v.number()), // Average COGS as % of revenue
  shippingCost: v.optional(v.number()), // Average shipping cost per order (per-order model)
  paymentFeePercent: v.optional(v.number()), // Payment processing fee %
  paymentFixedFee: v.optional(v.number()), // Fixed fee component per transaction (e.g. $0.30)
  taxPercent: v.optional(v.number()), // Average tax rate %
  marketingPercent: v.optional(v.number()), // Marketing as % of revenue (optional)
  operatingCosts: v.optional(v.number()), // Monthly operating costs (optional)

  // Optional per-item onboarding defaults
  shippingMode: v.optional(v.union(v.literal("per_order"), v.literal("per_item"))),
  shippingPerItem: v.optional(v.number()),
  handlingPerItem: v.optional(v.number()),

  // Setup metadata
  setupType: v.string(), // "initial_historical" or "dashboard_setup"
  appliedTo: v.string(), // "historical_60_days"
  setupBy: v.optional(v.id("users")), // User who set up the costs (optional for system-generated)

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_setup_type", ["setupType"]);

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
  .index("by_effective_from", ["effectiveFrom"]);
