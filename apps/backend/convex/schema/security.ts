import { defineTable } from "convex/server";
import { v } from "convex/values";

export const auditLogs = defineTable({
  organizationId: v.id("organizations"),
  userId: v.optional(v.id("users")),

  // Action info
  action: v.string(), // e.g., "settings_update", "integration_connect"
  category: v.union(
    v.literal("settings"),
    v.literal("integration"),
    v.literal("user_management"),
    v.literal("data_management"),
  ),

  // Details
  details: v.optional(
    v.object({
      before: v.optional(v.any()), // Previous state
      after: v.optional(v.any()), // New state
      changes: v.optional(v.array(v.string())), // List of changed fields
      metadata: v.optional(v.record(v.string(), v.any())), // Additional metadata
    }),
  ),

  // IP and location
  ipAddress: v.optional(v.string()),
  userAgent: v.optional(v.string()),

  // Timestamp
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"])
  .index("by_action", ["action"])
  .index("by_category", ["category"])
  .index("by_created", ["createdAt"])
  .index("by_org_category", ["organizationId", "category"]);

// webhookLogs removed: using minimal receipts only

// Minimal idempotent receipts for fast-path Shopify processing
export const webhookReceipts = defineTable({
  // Upstream identifiers
  providerWebhookId: v.string(),
  topic: v.string(),
  shopDomain: v.string(),

  // Processing outcome
  status: v.union(
    v.literal("processed"),
    v.literal("failed"),
  ),
  processedAt: v.number(),
  error: v.optional(v.string()),
})
  .index("by_provider", ["providerWebhookId"])
  .index("by_shop_topic", ["shopDomain", "topic"]);

export const gdprComplianceLogs = defineTable({
  // Request info
  requestType: v.union(
    v.literal("customers/data_request"),
    v.literal("customers/redact"),
    v.literal("shop/redact"),
  ),
  shopDomain: v.string(),
  shopId: v.optional(v.string()),

  // Customer info (if applicable)
  customerId: v.optional(v.string()),
  customerEmail: v.optional(v.string()),
  orderIds: v.optional(v.array(v.string())),

  // Request/Response data
  requestPayload: v.object({
    shop_id: v.string(),
    shop_domain: v.string(),
    orders_to_redact: v.optional(v.array(v.string())),
    customer: v.optional(
      v.object({
        id: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
    ),
    data_request: v.optional(
      v.object({
        id: v.string(),
      }),
    ),
  }),
  responseStatus: v.string(),
  processingResult: v.optional(
    v.object({
      success: v.boolean(),
      message: v.optional(v.string()),
      recordsProcessed: v.optional(v.number()),
      recordsDeleted: v.optional(v.number()),
      deletedCount: v.optional(
        v.object({
          customers: v.number(),
          orders: v.number(),
          products: v.optional(v.number()),
          stores: v.optional(v.number()),
        }),
      ),
      errors: v.optional(v.array(v.string())),
    }),
  ),

  // Timestamp
  processedAt: v.number(),
})
  .index("by_shop_domain", ["shopDomain"])
  .index("by_request_type", ["requestType"])
  .index("by_processed_at", ["processedAt"])
  .index("by_customer_email", ["customerEmail"]);

export const gdprRequests = defineTable({
  organizationId: v.id("organizations"),
  shopDomain: v.string(),
  customerId: v.string(), // "shop" for shop redaction requests

  // Request type
  requestType: v.union(
    v.literal("customer_data_request"),
    v.literal("customer_redact"),
    v.literal("shop_redact"),
  ),

  // Status
  status: v.union(
    v.literal("pending"),
    v.literal("completed"),
    v.literal("failed"),
  ),

  // Request and response data
  requestData: v.any(), // Original request data
  responseData: v.optional(v.any()), // Response data if applicable

  // Processing details
  processedAt: v.number(),
  processingTime: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
})
  .index("by_organization", ["organizationId"])
  .index("by_shop", ["shopDomain"])
  .index("by_customer", ["customerId"])
  .index("by_request_type", ["requestType"])
  .index("by_status", ["status"])
  .index("by_processed", ["processedAt"]);
