import { defineTable } from "convex/server";
import { v } from "convex/values";

export const apiKeys = defineTable({
  userId: v.id("users"),
  organizationId: v.id("organizations"),

  // Key metadata
  name: v.string(),
  key: v.string(), // Hashed API key
  prefix: v.string(), // First characters for identification

  // Usage tracking
  lastUsed: v.optional(v.number()),
  usageCount: v.number(),

  // Lifecycle
  revokedAt: v.optional(v.number()),
  isActive: v.boolean(),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_organization", ["organizationId"])
  .index("by_key", ["key"])
  .index("by_prefix", ["prefix"])
  .index("by_active", ["isActive"])
  .index("by_user_active", ["userId", "isActive"]);

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
  .index("by_shop_topic", ["shopDomain", "topic"])
  .index("by_processed_at", ["processedAt"]);

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
