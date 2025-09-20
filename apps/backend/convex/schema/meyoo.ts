import { defineTable } from "convex/server";
import { v } from "convex/values";

// Meyoo team invitations - for inviting team members to join Meyoo
export const meyooInvites = defineTable({
  // Invitation details
  email: v.string(),
  role: v.union(v.literal("MeyooAdmin"), v.literal("MeyooTeam")), // MeyooFounder is set manually

  // Invitation metadata
  invitedBy: v.id("users"), // MeyooFounder or MeyooAdmin who sent invitation
  inviterName: v.string(),
  message: v.optional(v.string()),

  // Status
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("rejected"),
    v.literal("expired"),
    v.literal("cancelled"),
  ),

  // Security
  invitationToken: v.string(),
  expiresAt: v.number(),

  // Response
  acceptedAt: v.optional(v.number()),
  acceptedBy: v.optional(v.id("users")),
  responseMessage: v.optional(v.string()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_invited_by", ["invitedBy"])
  .index("by_token", ["invitationToken"])
  .index("by_expires", ["expiresAt"])
  .index("by_email_status", ["email", "status"]);

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

// User activity logs - detailed tracking for Meyoo insights
export const userActivity = defineTable({
  userId: v.id("users"),
  organizationId: v.optional(v.id("organizations")),

  // Activity details
  action: v.string(), // "login", "onboarding_completed", "integration_connected", etc.
  category: v.union(
    v.literal("auth"),
    v.literal("onboarding"),
    v.literal("integration"),
    v.literal("billing"),
    v.literal("dashboard"),
    v.literal("ai"),
    v.literal("settings"),
  ),

  // Context
  details: v.optional(v.string()), // Human readable description
  metadata: v.optional(
    v.object({
      platform: v.optional(v.string()), // "shopify", "meta", "google"
      page: v.optional(v.string()), // Page where action occurred
      userAgent: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      duration: v.optional(v.number()), // Time spent on action
      success: v.optional(v.boolean()), // Whether action succeeded
      errorMessage: v.optional(v.string()),
    }),
  ),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_organization", ["organizationId"])
  .index("by_action", ["action"])
  .index("by_category", ["category"])
  .index("by_user_category", ["userId", "category"])
  .index("by_created", ["createdAt"])
  .index("by_user_created", ["userId", "createdAt"]);

// Note: Integration requests are handled by the main integrationRequests table
// Meyoo team will manage client requests through that table, not create separate ones

// Admin activity logs - track Meyoo team actions
export const adminActivity = defineTable({
  // Who performed the action
  adminId: v.id("users"), // MeyooFounder, MeyooAdmin, or MeyooTeam
  adminName: v.string(),
  adminRole: v.union(
    v.literal("MeyooFounder"),
    v.literal("MeyooAdmin"),
    v.literal("MeyooTeam"),
  ),

  // Action details
  action: v.string(), // "user_role_changed", "notification_sent", "user_suspended", etc.
  category: v.union(
    v.literal("user_management"),
    v.literal("organization_management"),
    v.literal("notification"),
    v.literal("system"),
    v.literal("billing"),
    v.literal("integration"),
  ),

  // Target of action
  targetUserId: v.optional(v.id("users")),
  targetOrganizationId: v.optional(v.id("organizations")),
  targetEmail: v.optional(v.string()),

  // Change details
  previousValue: v.optional(v.string()),
  newValue: v.optional(v.string()),
  description: v.string(), // Human readable description

  // Metadata
  metadata: v.optional(
    v.object({
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      reason: v.optional(v.string()), // Reason for action
      notificationId: v.optional(v.id("notifications")), // If related to notification
      integrationRequestId: v.optional(v.id("integrationRequests")), // If related to integration request
      inviteId: v.optional(v.id("meyooInvites")), // If related to team invitation
      notificationCount: v.optional(v.number()), // Number of notifications sent
      recipientCount: v.optional(v.union(v.number(), v.string())), // Number of recipients or "system-wide"
    }),
  ),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_admin", ["adminId"])
  .index("by_action", ["action"])
  .index("by_category", ["category"])
  .index("by_target_user", ["targetUserId"])
  .index("by_target_organization", ["targetOrganizationId"])
  .index("by_created", ["createdAt"])
  .index("by_admin_category", ["adminId", "category"]);

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
