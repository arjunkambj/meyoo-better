import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Sync Engine Schema
 * Tables for the smart adaptive sync system
 */

/**
 * Sync profiles track activity and determine sync frequency
 */
export const syncProfiles = defineTable({
  organizationId: v.id("organizations"),

  // Activity tracking
  activityScore: v.number(), // 0-999 points
  lastActivityAt: v.optional(v.number()),
  activityHistory: v.array(
    v.object({
      timestamp: v.number(),
      type: v.string(), // "login", "dashboard", "report", etc.
      points: v.number(),
      metadata: v.optional(v.any()),
    })
  ),

  // Sync frequency
  syncFrequency: v.number(), // Times per day (1-60)
  syncInterval: v.number(), // Milliseconds between syncs
  syncTier: v.string(), // "minimal", "low", "medium", "high", "maximum"

  // Sync timing
  lastSync: v.optional(v.number()),
  nextScheduledSync: v.optional(v.number()),

  // Business hours optimization
  businessHoursEnabled: v.boolean(),
  timezone: v.optional(v.string()),

  // Platform-specific settings
  platformSettings: v.optional(
    v.object({
      shopify: v.optional(
        v.object({
          webhooksEnabled: v.boolean(),
          realTimeProducts: v.boolean(),
          realTimeOrders: v.boolean(),
        })
      ),
      meta: v.optional(
        v.object({
          insightsFields: v.array(v.string()),
          datePreset: v.string(),
        })
      ),
      google: v.optional(
        v.object({
          customerIds: v.array(v.string()),
          reportTypes: v.array(v.string()),
        })
      ),
    })
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_next_sync", ["nextScheduledSync"]);

/**
 * Global platform rate limits (e.g., Meta 10k req/hour across all accounts)
 */
export const platformRateLimits = defineTable({
  platform: v.string(), // e.g. "meta"
  windowStart: v.number(),
  windowEnd: v.number(),
  used: v.number(),
  limit: v.number(),
  updatedAt: v.number(),
})
  .index("by_platform", ["platform"])
  .index("by_window", ["windowEnd"]);

/**
 * Lightweight scheduler state for round‑robin cursors
 */
export const schedulerState = defineTable({
  name: v.string(), // e.g. "meta:cursor"
  value: v.any(),
  updatedAt: v.number(),
}).index("by_name", ["name"]);

/**
 * Aggregated integration status snapshot per organization.
 * Note: authoritative status is derived in queries; this table is for
 * caching/snapshots and quick admin lookups.
 */
export const integrationStatus = defineTable({
  organizationId: v.id("organizations"),

  shopify: v.object({
    connected: v.boolean(),
    initialSynced: v.boolean(),
    stages: v.object({
      products: v.boolean(),
      inventory: v.boolean(),
      customers: v.boolean(),
      orders: v.boolean(),
    }),
    lastInitialCompletedAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    expectedOrders: v.optional(v.number()),
    ordersInDb: v.optional(v.number()),
  }),

  meta: v.object({
    connected: v.boolean(),
    initialSynced: v.boolean(),
    lastInitialCompletedAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
  }),

  analytics: v.object({
    ready: v.boolean(),
    lastCalculatedAt: v.optional(v.number()),
  }),

  updatedAt: v.number(),
}).index("by_organization", ["organizationId"]);
