import { defineTable } from "convex/server";
import { v } from "convex/values";

// System analytics - aggregated metrics for Meyoo dashboard
export const systemAnalytics = defineTable({
  // Time period
  date: v.string(), // Format: "2024-01-15" for daily, "2024-01" for monthly
  period: v.union(
    v.literal("daily"),
    v.literal("weekly"),
    v.literal("monthly"),
  ),

  // User metrics
  totalUsers: v.number(),
  newUsers: v.number(), // New users in this period
  onboardedUsers: v.number(), // Users who completed onboarding
  activeUsers: v.number(), // Users who logged in during period

  // Trial and paid metrics
  trialUsers: v.number(),
  paidUsers: v.number(),
  convertedUsers: v.number(), // Trial to paid conversions in period
  churnedUsers: v.number(), // Users who cancelled in period

  // Organization metrics
  totalOrganizations: v.number(),
  newOrganizations: v.number(),
  activeOrganizations: v.number(),

  // Store metrics
  totalStores: v.number(),
  newStores: v.number(),

  // Integration metrics
  shopifyConnections: v.number(),
  metaConnections: v.number(),
  googleConnections: v.number(),
  integrationRequests: v.number(), // New integration requests

  // AI usage metrics
  totalAIUsers: v.number(), // Users with AI access
  aiRequestsCount: v.number(), // Total AI requests
  averageAIUsagePerUser: v.number(),

  // Revenue metrics (estimated)
  estimatedMRR: v.number(), // Monthly recurring revenue
  estimatedARR: v.number(), // Annual recurring revenue

  // Metadata
  calculatedAt: v.number(),
  version: v.optional(v.string()), // For schema versioning
})
  .index("by_date", ["date"])
  .index("by_period", ["period"])
  .index("by_date_period", ["date", "period"])
  .index("by_calculated", ["calculatedAt"]);

// System health metrics - for monitoring platform health
export const systemHealth = defineTable({
  // Time period
  timestamp: v.number(),
  date: v.string(), // "2024-01-15"
  hour: v.number(), // 0-23 for hourly metrics

  // Performance metrics
  averageResponseTime: v.number(), // in milliseconds
  errorRate: v.number(), // percentage
  uptime: v.number(), // percentage

  // Usage metrics
  activeConnections: v.number(),
  apiCallsPerHour: v.number(),
  syncJobsProcessed: v.number(),
  syncJobsFailed: v.number(),

  // Resource usage
  databaseSize: v.optional(v.number()), // in MB
  storageUsed: v.optional(v.number()), // in MB
  bandwidthUsed: v.optional(v.number()), // in MB

  // Integration health
  shopifyHealthy: v.boolean(),
  metaHealthy: v.boolean(),
  googleHealthy: v.boolean(),

  // Alerts
  criticalAlerts: v.number(),
  warningAlerts: v.number(),

  // Metadata
  version: v.optional(v.string()),
})
  .index("by_date", ["date"])
  .index("by_timestamp", ["timestamp"])
  .index("by_date_hour", ["date", "hour"]);
