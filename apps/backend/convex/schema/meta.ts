import { defineTable } from "convex/server";
import { v } from "convex/values";

// Meta ad accounts
export const metaAdAccounts = defineTable({
  organizationId: v.id("organizations"),
  connectionId: v.id("integrationSessions"),

  // Account info
  accountId: v.string(), // act_xxxxx
  accountName: v.string(),

  // Business
  businessId: v.optional(v.string()),
  metaBusinessName: v.optional(v.string()),

  // Settings
  timezone: v.optional(v.string()),
  timezoneOffsetHours: v.optional(v.number()),

  // Status
  accountStatus: v.optional(v.number()),
  disableReason: v.optional(v.string()),

  // Spend limits
  spendCap: v.optional(v.number()),
  amountSpent: v.optional(v.number()),

  // Primary account flag
  isPrimary: v.optional(v.boolean()),

  // Status
  status: v.optional(v.string()),

  // Metadata
  isActive: v.boolean(),
  syncedAt: v.number(),
  lastCalculatedAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_connection", ["connectionId"])
  .index("by_account", ["accountId"])
  .index("by_active", ["isActive"])
  .index("by_organization_and_active", ["organizationId", "isActive"])
  .index("by_organization_and_isPrimary", ["organizationId", "isPrimary"])
  .index("by_account_org", ["accountId", "organizationId"]);

// Meta insights (aggregated daily)
export const metaInsights = defineTable({
  organizationId: v.id("organizations"),

  // Reference
  entityType: v.union(
    v.literal("account"),
    v.literal("campaign"),
    v.literal("adset"),
    v.literal("ad"),
  ),
  entityId: v.string(), // The ID of the account/campaign/adset/ad

  // For account level, entityId is the accountId
  // This allows us to track daily account totals separately from campaign data

  // Date
  date: v.string(), // YYYY-MM-DD

  // Spend
  spend: v.number(),

  // Reach & Impressions
  reach: v.optional(v.number()),
  impressions: v.number(),
  frequency: v.optional(v.number()),

  // Engagement
  clicks: v.number(),
  uniqueClicks: v.optional(v.number()),
  ctr: v.optional(v.number()),
  cpc: v.optional(v.number()),
  cpm: v.optional(v.number()),

  // Conversions & Revenue
  conversions: v.optional(v.number()),
  conversionValue: v.optional(v.number()),
  costPerConversion: v.optional(v.number()),
  roas: v.optional(v.number()),

  // Other actions
  addToCart: v.optional(v.number()),
  initiateCheckout: v.optional(v.number()),
  pageViews: v.optional(v.number()),

  // Quality scores
  qualityRanking: v.optional(v.string()),
  engagementRateRanking: v.optional(v.string()),
  conversionRateRanking: v.optional(v.string()),

  // Additional conversion events
  viewContent: v.optional(v.number()),

  // Video metrics
  videoViews: v.optional(v.number()),
  video3SecViews: v.optional(v.number()),
  videoThruPlay: v.optional(v.number()),
  costPerThruPlay: v.optional(v.number()),

  // Link metrics
  linkClicks: v.optional(v.number()),
  outboundClicks: v.optional(v.number()),
  landingPageViews: v.optional(v.number()),

  // Metadata
  syncedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_entity", ["entityType", "entityId"])
  .index("by_date", ["date"])
  .index("by_entity_date", ["entityType", "entityId", "date"])
  .index("by_org_date", ["organizationId", "date"])
  .index("by_org_entity_type_and_id", [
    "organizationId",
    "entityType",
    "entityId",
  ]);
