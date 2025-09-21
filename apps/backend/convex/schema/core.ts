import { defineTable } from "convex/server";
import { v } from "convex/values";

// Users table - simplified but with all necessary fields
export const users = defineTable({
  // Basic info
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),

  // Organization - single organization for all users
  organizationId: v.optional(v.id("organizations")),

  // Role - store and Meyoo team roles only
  role: v.optional(
    v.union(
      v.literal("StoreOwner"), // Store owner
      v.literal("StoreTeam"), // Store team member
      v.literal("MeyooFounder"), // Meyoo founder (full system access)
      v.literal("MeyooAdmin"), // Meyoo admin (system management)
      v.literal("MeyooTeam"), // Meyoo team member (limited system access)
    ),
  ),

  // Onboarding - simplified to single flag
  isOnboarded: v.optional(v.boolean()),

  // Settings
  primaryCurrency: v.optional(v.string()),

  // Status
  status: v.optional(
    v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("invited"),
      v.literal("suspended"),
      v.literal("deleted"),
    ),
  ),
  appDeletedAt: v.optional(v.number()),
  lastLoginAt: v.optional(v.number()),
  loginCount: v.optional(v.number()),

  // Timestamps
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("email", ["email"])
  .index("by_email_verification_time", ["emailVerificationTime"])
  .index("by_organization", ["organizationId"])
  .index("by_isOnboarded", ["isOnboarded"])
  .index("by_role", ["role"])
  .index("by_organization_and_role", ["organizationId", "role"])
  .index("by_status", ["status"]);

// Simplified organizations table - store-centric
export const organizations = defineTable({
  // Core fields
  name: v.string(),
  ownerId: v.id("users"),

  // Business info (common for both)
  businessType: v.optional(v.string()),
  businessCategory: v.optional(v.string()),
  industry: v.optional(v.string()),
  locale: v.optional(v.string()),
  timezone: v.optional(v.string()),
  // Trial management - 14-day trial for new users
  trialStartDate: v.optional(v.number()),
  trialEndDate: v.optional(v.number()),
  isTrialActive: v.optional(v.boolean()),
  hasTrialExpired: v.optional(v.boolean()),

  // Resource limits (simplified)
  apiCallLimit: v.optional(v.number()),
  storageLimit: v.optional(v.number()),

  // Quick status checks
  isPremium: v.optional(v.boolean()),
  requiresUpgrade: v.optional(v.boolean()),

  // Metadata
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_owner", ["ownerId"]);

// Memberships: user ↔ organization link with role + seat info
export const memberships = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"),

  // Access & role within org
  role: v.union(
    v.literal("StoreOwner"),
    v.literal("StoreTeam"),
  ),
  status: v.union(
    v.literal("active"),
    v.literal("suspended"),
    v.literal("removed"),
  ),

  // Seat & AI access
  seatType: v.union(v.literal("free"), v.literal("paid")),
  hasAiAddOn: v.optional(v.boolean()),
  hasAIAccess: v.optional(v.boolean()), // convenience cache
  monthlyCost: v.optional(v.number()),

  // Audit
  assignedAt: v.optional(v.number()),
  assignedBy: v.optional(v.id("users")),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_org", ["organizationId"])
  .index("by_user", ["userId"])
  .index("by_org_user", ["organizationId", "userId"])
  .index("by_org_status", ["organizationId", "status"])
  .index("by_org_role", ["organizationId", "role"]);

// Unified invites table
export const invites = defineTable({
  // Organization context
  organizationId: v.id("organizations"),

  // Invitation type
  type: v.union(
    v.literal("team_member"), // Store owner inviting team member
  ),

  // Invitation details
  email: v.string(),
  role: v.optional(
    v.union(
      v.literal("StoreTeam"),
    ),
  ),

  // Status
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("rejected"),
    v.literal("expired"),
    v.literal("cancelled"),
  ),

  // Invitation metadata
  invitedBy: v.object({
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.string(),
  }),
  message: v.optional(v.string()),

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
  .index("by_organization", ["organizationId"])
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_organization_status", ["organizationId", "status"])
  .index("by_email_organization", ["email", "organizationId"])
  .index("by_token", ["invitationToken"])
  .index("by_expires", ["expiresAt"]);

// Multi-dashboard support
export const dashboards = defineTable({
  organizationId: v.id("organizations"),
  userId: v.optional(v.id("users")), // For user-specific dashboards
  name: v.string(),
  description: v.optional(v.string()),

  // Type and settings
  type: v.union(v.literal("main"), v.literal("custom")),
  isDefault: v.optional(v.boolean()),
  // Organization default flag (true when a default dashboard is not user-specific)
  isOrgDefault: v.optional(v.boolean()),

  // Access control
  visibility: v.union(
    v.literal("private"),
    v.literal("team"),
    v.literal("public"),
  ),
  allowedUsers: v.optional(v.array(v.id("users"))),

  // Configuration - Simplified dashboard layout
  config: v.optional(
    v.object({
      // KPI Cards
      kpis: v.array(v.string()), // Array of metric IDs
      // Widgets
      widgets: v.array(v.string()), // Array of widget IDs
    }),
  ),

  // Metadata
  createdBy: v.id("users"),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"])
  .index("by_type", ["type"])
  .index("by_organizationId_and_isDefault", ["organizationId", "isDefault"])
  .index("by_organization_and_user", ["organizationId", "userId"])
  .index("by_user_and_isDefault", ["userId", "isDefault"])
  .index("by_org_isDefault_orgDefault", [
    "organizationId",
    "isDefault",
    "isOrgDefault",
  ]);

// Integration sessions for OAuth tokens
export const integrationSessions = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"),

  // Platform
  platform: v.union(v.literal("shopify"), v.literal("meta")),

  // Auth tokens
  accessToken: v.string(),
  refreshToken: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  scope: v.optional(v.string()),

  // Platform-specific identifiers
  accountId: v.optional(v.string()),
  accountName: v.optional(v.string()),

  // Status
  isActive: v.boolean(),
  lastUsedAt: v.optional(v.number()),

  // Metadata
  metadata: v.optional(
    v.object({
      deviceId: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      additionalScopes: v.optional(v.array(v.string())),
      // Token management metadata (optional)
      tokenKind: v.optional(v.union(v.literal("short"), v.literal("long"))),
      shortLivedAccessToken: v.optional(v.string()),
      lastRefreshedAt: v.optional(v.number()),
      // Meta app validation metadata (optional)
      appId: v.optional(v.string()),
      appIdCheckedAt: v.optional(v.number()),
      appMismatch: v.optional(v.boolean()),
    }),
  ),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"])
  .index("by_org_and_platform", ["organizationId", "platform"])
  .index("by_org_platform_and_status", [
    "organizationId",
    "platform",
    "isActive",
  ])
  .index("by_org_platform_and_user", ["organizationId", "platform", "userId"])
  .index("by_user_and_organization", ["userId", "organizationId"]);

// Sync sessions for tracking sync operations
export const syncSessions = defineTable({
  organizationId: v.id("organizations"),

  // Platform and type
  platform: v.union(
    v.literal("shopify"),
    v.literal("meta"),
  ),
  type: v.string(), // "full", "incremental", "orders", "products", etc.

  // Status
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("syncing"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("cancelled"),
  ),

  // Progress
  recordsProcessed: v.optional(v.number()),
  recordsFailed: v.optional(v.number()),

  // Timing
  startedAt: v.number(),
  completedAt: v.optional(v.number()),

  // Error tracking
  error: v.optional(v.string()),

  // Metadata
  metadata: v.optional(
    v.object({
      syncedEntities: v.optional(v.array(v.string())),
      lastCursor: v.optional(v.string()),
      totalPages: v.optional(v.number()),
      currentPage: v.optional(v.number()),
      isInitialSync: v.optional(v.boolean()),
      filters: v.optional(
        v.object({
          dateFrom: v.optional(v.string()),
          dateTo: v.optional(v.string()),
          status: v.optional(v.string()),
        }),
      ),
    }),
  ),
})
  .index("by_organization", ["organizationId"])
  .index("by_platform", ["platform"])
  .index("by_status", ["status"])
  .index("by_started_at", ["startedAt"])
  .index("by_org_platform_and_status", ["organizationId", "platform", "status"])
  .index("by_org_platform_and_date", [
    "organizationId",
    "platform",
    "startedAt",
  ]);

// Dedicated onboarding table - centralized onboarding state management
export const onboarding = defineTable({
  // User and organization context
  userId: v.id("users"),
  organizationId: v.id("organizations"),

  // Current onboarding state
  onboardingStep: v.optional(v.number()),
  isCompleted: v.optional(v.boolean()),

  // Integration connection status
  hasShopifyConnection: v.optional(v.boolean()),
  hasShopifySubscription: v.optional(v.boolean()),
  // Step-specific setup flags for 7-step onboarding
  isProductCostSetup: v.optional(v.boolean()), // step 5
  isExtraCostSetup: v.optional(v.boolean()),   // step 6
  hasMetaConnection: v.optional(v.boolean()),
  hasGoogleConnection: v.optional(v.boolean()),
  isInitialSyncComplete: v.optional(v.boolean()),

  // Setup progress

  // Onboarding metadata
  onboardingData: v.optional(
    v.object({
      referralSource: v.optional(v.string()),
      setupDate: v.optional(v.string()),
      completedSteps: v.optional(v.array(v.string())),
    }),
  ),

  // Timestamps
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_organization", ["organizationId"])
  .index("by_user_organization", ["userId", "organizationId"])
  .index("by_completed", ["isCompleted"])
  .index("by_step", ["onboardingStep"]);

export const billing = defineTable({
  organizationId: v.id("organizations"),

  // Organization type determines billing path
  organizationType: v.union(
    v.literal("shopify_app"), // Uses Shopify's built-in billing
  ),

  // For Shopify Apps - uses Shopify's built-in billing system
  shopifyBilling: v.optional(
    v.object({
      plan: v.union(
        v.literal("free"),
        v.literal("starter"),
        v.literal("growth"),
        v.literal("business"),
      ),
      shopifyChargeId: v.optional(v.string()),
      isActive: v.boolean(),
      shopifySubscriptionId: v.optional(v.string()),
      // Raw Shopify subscription status as last seen (e.g., ACTIVE, CANCELLED, PAUSED)
      status: v.optional(v.string()),
      
      // Tracking fields for plan transitions
      previousSubscriptionId: v.optional(v.string()), // Track replaced subscription
      isUpgrading: v.optional(v.boolean()),          // Flag during plan transitions
      lastTransitionAt: v.optional(v.number()),      // Timestamp of last plan change
      transitionHistory: v.optional(v.array(         // Track all transitions
        v.object({
          fromPlan: v.string(),
          toPlan: v.string(),
          subscriptionId: v.string(),
          timestamp: v.number(),
        })
      )),
    }),
  ),
  // Common billing fields
  isPremium: v.boolean(), // Quick check for premium features
  billingCycle: v.optional(v.union(v.literal("monthly"), v.literal("yearly"))),

  // Status
  status: v.optional(
    v.union(
      v.literal("active"),
      v.literal("trial"),
      v.literal("cancelled"),
      v.literal("suspended"),
    ),
  ),

  // Dates
  trialEndsAt: v.optional(v.number()),
  nextBillingDate: v.optional(v.number()),

  // Payment method details
  paymentMethod: v.optional(v.string()), // last 4 digits of card

  // Metadata
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_type", ["organizationType"])
  .index("by_status", ["status"])
  .index("by_org_type_status", [
    "organizationId",
    "organizationType",
    "status",
  ]);

// Unified usage tracking (org/month + type)
export const usage = defineTable({
  organizationId: v.id("organizations"),
  month: v.string(), // "YYYY-MM"
  type: v.union(
    v.literal("orders"),
    v.literal("activeClients"),
    v.literal("aiMessages"),
  ),
  subjectId: v.optional(v.id("users")), // for per-user usage like AI
  count: v.number(),
  limit: v.optional(v.number()),
  metadata: v.optional(v.any()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_org_month", ["organizationId", "month"]) 
  .index("by_org_month_type", ["organizationId", "month", "type"]) 
  .index("by_user_month", ["subjectId", "month"]);

// Invoices for billing history
export const invoices = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"),

  // Invoice details
  invoiceNumber: v.string(), // INV-2024-001
  amount: v.number(),
  currency: v.string(), // USD, EUR, etc.
  status: v.union(
    v.literal("paid"),
    v.literal("pending"),
    v.literal("failed"),
    v.literal("refunded"),
    v.literal("cancelled"),
  ),

  // Plan and seat details
  plan: v.union(
    v.literal("free"),
    v.literal("starter"),
    v.literal("growth"),
    v.literal("business"),
  ),
  description: v.string(), // "Growth Plan - Monthly + 2 additional seats"

  // Breakdown
  lineItems: v.array(
    v.object({
      description: v.string(), // "Base Plan", "Additional Seats (2 × $15)"
      quantity: v.number(),
      unitPrice: v.number(),
      amount: v.number(),
    }),
  ),

  // Billing period
  billingPeriodStart: v.string(), // YYYY-MM-DD
  billingPeriodEnd: v.string(), // YYYY-MM-DD

  // Dates
  issuedAt: v.number(),
  paidAt: v.optional(v.number()),
  dueDate: v.optional(v.number()),

  // Additional details
  downloadUrl: v.optional(v.string()),
  
  // Shopify subscription tracking
  shopifySubscriptionId: v.optional(v.string()),  // Link invoice to specific subscription
  isSuperseded: v.optional(v.boolean()),         // Mark old invoices as replaced
  
  metadata: v.optional(
    v.object({
      stripeInvoiceId: v.optional(v.string()),
      paymentMethod: v.optional(v.string()),
      taxAmount: v.optional(v.number()),
      discount: v.optional(v.number()),
      orderCount: v.optional(v.number()), // Orders processed in this period
      paidSeats: v.optional(v.number()), // Number of paid seats in this invoice
    }),
  ),

  // Metadata
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_organization_and_status", ["organizationId", "status"])
  .index("by_issued_date", ["issuedAt"]);

// Simplified AI limits (kept for reference)
export const aiLimits = {
  free: { monthly: 50 },
  paid: { monthly: 1000 },
};

// Notifications table for system-wide notifications
export const notifications = defineTable({
  title: v.string(),
  message: v.string(),
  type: v.union(
    v.literal("info"),
    v.literal("warning"),
    v.literal("success"),
    v.literal("error"),
    v.literal("system"),
  ),

  // Status and actions
  isRead: v.optional(v.boolean()),
  // System-wide notifications (when true, applies to all users)
  isSystem: v.optional(v.boolean()),
  organizationId: v.optional(v.id("organizations")),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_type", ["type"])
  .index("by_organization", ["organizationId"])
  .index("by_system", ["isSystem"])
  .index("by_created", ["createdAt"]);

export const integrationRequests = defineTable({
  // Platform details
  platformName: v.string(),
  description: v.string(),

  // User and organization
  userId: v.id("users"),
  organizationId: v.id("organizations"),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"])
  .index("by_created", ["createdAt"])
  .index("by_platform", ["platformName"]);
