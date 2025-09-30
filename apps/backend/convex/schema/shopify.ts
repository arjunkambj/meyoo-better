import { defineTable } from "convex/server";
import { v } from "convex/values";

// Shopify store connection (includes session data)
export const shopifyStores = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"), // User who connected this store

  // Store details
  shopDomain: v.string(),
  storeName: v.string(),
  storeEmail: v.optional(v.string()),

  // Auth & Session
  accessToken: v.string(),
  scope: v.optional(v.string()),
  sessionId: v.optional(v.string()), // Shopify session ID
  isOnline: v.optional(v.boolean()), // true for user tokens, false for offline tokens

  // Store settings
  operatingCountry: v.optional(v.string()),
  primaryCurrency: v.optional(v.string()),
  isGlobalStore: v.optional(v.boolean()),

  // API info
  apiVersion: v.optional(v.string()),
  webhooksRegistered: v.optional(v.boolean()),

  // Status
  isActive: v.boolean(),
  lastSyncAt: v.optional(v.number()),
  uninstalledAt: v.optional(v.number()),

  // Soft delete flags
  isDeleted: v.optional(v.boolean()),
  deletedAt: v.optional(v.number()),

  // Metadata
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_shop_domain", ["shopDomain"])
  .index("by_domain_and_active", ["shopDomain", "isActive"])
  .index("by_organization_and_active", ["organizationId", "isActive"]);

// Shopify orders
export const shopifyOrders = defineTable({
  organizationId: v.id("organizations"),
  storeId: v.id("shopifyStores"),

  // Shopify identifiers
  shopifyId: v.string(),
  orderNumber: v.string(),
  name: v.string(), // #1001

  // Customer info
  customerId: v.optional(v.id("shopifyCustomers")),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),

  // Order details
  shopifyCreatedAt: v.number(),
  processedAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
  closedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),

  // Financial
  totalPrice: v.number(),
  subtotalPrice: v.number(),
  totalTax: v.number(),
  totalDiscounts: v.number(),
  totalShippingPrice: v.number(),
  totalTip: v.optional(v.number()),
  currency: v.optional(v.string()), // Currency code for this order

  // Status
  financialStatus: v.optional(v.string()),
  fulfillmentStatus: v.optional(v.string()),

  // Items
  totalItems: v.number(),
  totalQuantity: v.number(),
  totalWeight: v.optional(v.number()),
  totalWeightUnit: v.optional(v.string()),

  // Shipping
  shippingAddress: v.optional(
    v.object({
      country: v.optional(v.string()),
      province: v.optional(v.string()),
      city: v.optional(v.string()),
      zip: v.optional(v.string()),
    }),
  ),

  // Tags and notes
  tags: v.optional(v.array(v.string())),
  note: v.optional(v.string()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_and_created", ["organizationId", "shopifyCreatedAt"])
  .index("by_store", ["storeId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_customer", ["customerId"])
  .index("by_created", ["shopifyCreatedAt"])
  .index("by_financial_status", ["financialStatus"])
  .index("by_fulfillment_status", ["fulfillmentStatus"])
  .index("by_shopify_id_store", ["shopifyId", "storeId"]);

// Shopify order items
export const shopifyOrderItems = defineTable({
  organizationId: v.id("organizations"),
  orderId: v.id("shopifyOrders"),

  // Item identifiers
  shopifyId: v.string(),
  shopifyProductId: v.optional(v.string()),
  shopifyVariantId: v.optional(v.string()),

  // Product info
  productId: v.optional(v.id("shopifyProducts")),
  variantId: v.optional(v.id("shopifyProductVariants")),
  title: v.string(),
  variantTitle: v.optional(v.string()),
  sku: v.optional(v.string()),

  // Quantities and pricing
  quantity: v.number(),
  price: v.number(),
  totalDiscount: v.number(),

  // Fulfillment
  fulfillableQuantity: v.number(),
  fulfillmentStatus: v.optional(v.string()),
})
  .index("by_order", ["orderId"])
  .index("by_product", ["productId"])
  .index("by_variant", ["variantId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_organization", ["organizationId"]);

// Shopify products
export const shopifyProducts = defineTable({
  organizationId: v.id("organizations"),
  storeId: v.id("shopifyStores"),

  // Identifiers
  shopifyId: v.string(),
  handle: v.string(),

  // Product info
  title: v.string(),
  productType: v.optional(v.string()),
  vendor: v.optional(v.string()),
  status: v.string(),
  featuredImage: v.optional(v.string()),

  // Inventory
  totalInventory: v.optional(v.number()),
  totalVariants: v.number(),

  // SEO
  tags: v.optional(v.array(v.string())),

  // Timestamps
  shopifyCreatedAt: v.number(),
  shopifyUpdatedAt: v.number(),
  publishedAt: v.optional(v.number()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_store", ["storeId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_handle", ["handle"])
  .index("by_status", ["status"])
  .index("by_shopify_id_store", ["shopifyId", "storeId"]);

// Shopify product variants
export const shopifyProductVariants = defineTable({
  organizationId: v.id("organizations"),
  productId: v.id("shopifyProducts"),

  // Identifiers
  shopifyId: v.string(),
  shopifyProductId: v.string(),
  sku: v.optional(v.string()),
  barcode: v.optional(v.string()),

  // Variant info
  title: v.string(),
  position: v.number(),

  // Pricing
  price: v.number(),
  compareAtPrice: v.optional(v.number()),

  // Inventory
  inventoryQuantity: v.optional(v.number()),
  inventoryPolicy: v.optional(v.string()),
  inventoryManagement: v.optional(v.string()),

  // Weight
  weight: v.optional(v.number()),
  weightUnit: v.optional(v.string()),

  // Options
  option1: v.optional(v.string()),
  option2: v.optional(v.string()),
  option3: v.optional(v.string()),

  // Status
  available: v.optional(v.boolean()),

  // Cost metadata is sourced from variantCosts; only keep raw Shopify inventory linkage
  inventoryItemId: v.optional(v.string()),
  taxable: v.optional(v.boolean()),

  // Timestamps
  shopifyCreatedAt: v.number(),
  shopifyUpdatedAt: v.number(),
})
  .index("by_product", ["productId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_sku", ["sku"])
  .index("by_barcode", ["barcode"])
  .index("by_organization", ["organizationId"])
  .index("by_inventory_item", ["organizationId", "inventoryItemId"]);

// Shopify customers
export const shopifyCustomers = defineTable({
  organizationId: v.id("organizations"),
  storeId: v.id("shopifyStores"),

  // Identifiers
  shopifyId: v.string(),

  // Customer info
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),

  // Stats
  ordersCount: v.number(),
  totalSpent: v.number(),

  // Status
  state: v.optional(v.string()),
  verifiedEmail: v.optional(v.boolean()),
  taxExempt: v.optional(v.boolean()),

  // Location
  defaultAddress: v.optional(
    v.object({
      country: v.optional(v.string()),
      province: v.optional(v.string()),
      city: v.optional(v.string()),
      zip: v.optional(v.string()),
    }),
  ),

  // Metadata
  tags: v.optional(v.array(v.string())),
  note: v.optional(v.string()),

  // Timestamps
  shopifyCreatedAt: v.number(),
  shopifyUpdatedAt: v.number(),

  // Sync
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_store", ["storeId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_email", ["email"])
  .index("by_shopify_id_store", ["shopifyId", "storeId"]);

// Shopify transactions
export const shopifyTransactions = defineTable({
  organizationId: v.id("organizations"),
  orderId: v.id("shopifyOrders"),

  // Identifiers
  shopifyId: v.string(),
  shopifyOrderId: v.string(),

  // Transaction details
  kind: v.string(), // sale, refund, etc.
  status: v.string(),
  gateway: v.string(),

  // Amounts
  amount: v.number(),

  // Fees
  fee: v.optional(v.number()),

  // Payment reference
  paymentId: v.optional(v.string()),

  // Timestamps
  shopifyCreatedAt: v.number(),
  processedAt: v.optional(v.number()),
})
  .index("by_order", ["orderId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_kind", ["kind"])
  .index("by_status", ["status"])
  .index("by_gateway", ["gateway"])
  .index("by_organization", ["organizationId"]);

// Shopify refunds
export const shopifyRefunds = defineTable({
  organizationId: v.id("organizations"),
  orderId: v.id("shopifyOrders"),

  // Identifiers
  shopifyId: v.string(),
  shopifyOrderId: v.string(),

  // Refund details
  note: v.optional(v.string()),
  userId: v.optional(v.string()),

  // Amounts
  totalRefunded: v.number(),

  // Line items refunded
  refundLineItems: v.optional(
    v.array(
      v.object({
        lineItemId: v.string(),
        quantity: v.number(),
        subtotal: v.number(),
      }),
    ),
  ),

  // Timestamps
  shopifyCreatedAt: v.number(),
  processedAt: v.optional(v.number()),
})
  .index("by_order", ["orderId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_created", ["shopifyCreatedAt"])
  .index("by_organization", ["organizationId"]);

// Shopify fulfillments
export const shopifyFulfillments = defineTable({
  organizationId: v.id("organizations"),
  orderId: v.id("shopifyOrders"),

  // Identifiers
  shopifyId: v.string(),
  shopifyOrderId: v.string(),

  // Fulfillment details
  status: v.string(),
  shipmentStatus: v.optional(v.string()),

  // Tracking
  trackingCompany: v.optional(v.string()),
  trackingNumbers: v.optional(v.array(v.string())),
  trackingUrls: v.optional(v.array(v.string())),

  // Location
  locationId: v.optional(v.string()),

  // Service
  service: v.optional(v.string()),

  // Line items
  lineItems: v.optional(
    v.array(
      v.object({
        id: v.string(),
        quantity: v.number(),
      }),
    ),
  ),

  // Timestamps
  shopifyCreatedAt: v.number(),
  shopifyUpdatedAt: v.optional(v.number()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_order", ["orderId"])
  .index("by_shopify_id", ["shopifyId"])
  .index("by_status", ["status"]);

// Shopify inventory levels
export const shopifyInventory = defineTable({
  organizationId: v.id("organizations"),
  variantId: v.id("shopifyProductVariants"),

  // Location
  locationId: v.string(),
  locationName: v.optional(v.string()),

  // Quantities
  available: v.number(),
  incoming: v.optional(v.number()),
  committed: v.optional(v.number()),

  // Metadata
  updatedAt: v.number(),
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_variant", ["variantId"])
  .index("by_location", ["locationId"])
  .index("by_variant_location", ["variantId", "locationId"]);

// Shopify sessions for tracking visitor behavior
export const shopifySessions = defineTable({
  organizationId: v.id("organizations"),
  storeId: v.id("shopifyStores"),

  // Session identifiers
  sessionId: v.string(), // Unique session ID from Shopify
  visitorToken: v.optional(v.string()), // Browser visitor token

  // Session details
  startTime: v.number(),
  endTime: v.optional(v.number()),

  // Traffic source
  referrerSource: v.optional(v.string()), // google, facebook, direct, etc.
  referrerDomain: v.optional(v.string()),
  landingPage: v.optional(v.string()),

  // UTM parameters
  utmSource: v.optional(v.string()),
  utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()),
  utmContent: v.optional(v.string()),
  utmTerm: v.optional(v.string()),

  // Session activity
  pageViews: v.number(),

  // Device & location
  deviceType: v.optional(v.string()), // desktop, mobile, tablet
  country: v.optional(v.string()),
  region: v.optional(v.string()),
  city: v.optional(v.string()),

  // Conversion tracking
  hasConverted: v.boolean(),
  conversionValue: v.optional(v.number()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_store", ["storeId"])
  .index("by_session_id", ["sessionId"])
  .index("by_visitor_token", ["visitorToken"])
  .index("by_start_time", ["startTime"])
  .index("by_conversion", ["hasConverted"])
  .index("by_referrer_source", ["referrerSource"])
  .index("by_store_and_date", ["storeId", "startTime"]);

// Shopify analytics aggregates (sessions, traffic sources, etc.)
export const shopifyAnalytics = defineTable({
  organizationId: v.id("organizations"),
  storeId: v.id("shopifyStores"),

  date: v.string(), // YYYY-MM-DD
  trafficSource: v.string(), // e.g., direct, google, facebook

  sessions: v.number(),
  visitors: v.optional(v.number()),
  pageViews: v.optional(v.number()),
  bounceRate: v.optional(v.number()),
  conversionRate: v.optional(v.number()),
  conversions: v.optional(v.number()),

  dataSource: v.optional(v.string()), // shopify_analytics, inferred_orders, etc.
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_date", ["organizationId", "date"])
  .index("by_store_date_source", ["storeId", "date", "trafficSource"]);
