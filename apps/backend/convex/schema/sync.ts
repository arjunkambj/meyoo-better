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
    }),
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
        }),
      ),
      meta: v.optional(
        v.object({
          insightsFields: v.array(v.string()),
          datePreset: v.string(),
        }),
      ),
      google: v.optional(
        v.object({
          customerIds: v.array(v.string()),
          reportTypes: v.array(v.string()),
        }),
      ),
    }),
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_next_sync", ["nextScheduledSync"]);

/**
 * Sync history for analytics and debugging
 */
export const syncHistory = defineTable({
  organizationId: v.id("organizations"),
  platform: v.string(),

  // Aggregated daily stats
  date: v.string(), // YYYY-MM-DD

  // Sync counts
  totalSyncs: v.number(),
  successfulSyncs: v.number(),
  failedSyncs: v.number(),
  manualSyncs: v.number(),

  // Data volume
  recordsProcessed: v.number(),
  dataTransferred: v.number(), // Bytes
  apiCallsUsed: v.number(),

  // Performance
  avgSyncDuration: v.number(), // Milliseconds
  minSyncDuration: v.number(),
  maxSyncDuration: v.number(),

  // Errors
  errors: v.array(
    v.object({
      timestamp: v.number(),
      message: v.string(),
      count: v.number(),
    }),
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_date", ["organizationId", "date"])
  .index("by_org_platform_date", ["organizationId", "platform", "date"]);

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
})
  .index("by_name", ["name"]);

/**
 * Data freshness tracking
 */
export const dataFreshness = defineTable({
  organizationId: v.id("organizations"),

  // Per-platform freshness
  platforms: v.object({
    shopify: v.optional(
      v.object({
        lastSync: v.number(),
        lastWebhook: v.optional(v.number()),
        dataAge: v.number(), // Minutes since last update
        isStale: v.boolean(),
      }),
    ),
    meta: v.optional(
      v.object({
        lastSync: v.number(),
        dataAge: v.number(),
        isStale: v.boolean(),
      }),
    ),
    google: v.optional(
      v.object({
        lastSync: v.number(),
        dataAge: v.number(),
        isStale: v.boolean(),
      }),
    ),
  }),

  // Overall freshness
  overallFreshness: v.number(), // 0-100 score
  needsSync: v.boolean(),
  priority: v.string(), // "low", "medium", "high", "critical"

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_needs_sync", ["needsSync", "priority"]);

/**
 * Presence sessions for lightweight online detection
 */
// presenceSessions removed: presence/heartbeat was eliminated in favor of simpler scheduling
