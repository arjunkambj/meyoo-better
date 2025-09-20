import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Activity types and their weights for calculating sync frequency
 */
const ACTIVITY_WEIGHTS = {
  login: 10, // User logged in
  dashboard: 5, // Viewed dashboard
  widget: 3, // Interacted with widget
  report: 8, // Generated report
  api: 4, // API access
  export: 7, // Exported data
  settings: 2, // Changed settings
} as const;

/**
 * Sync frequency tiers based on activity score
 */
const SYNC_TIERS = [
  { minScore: 0, maxScore: 10, syncsPerDay: 1, interval: 86400000 }, // 24 hours
  { minScore: 11, maxScore: 30, syncsPerDay: 4, interval: 21600000 }, // 6 hours
  { minScore: 31, maxScore: 50, syncsPerDay: 8, interval: 10800000 }, // 3 hours
  { minScore: 51, maxScore: 70, syncsPerDay: 12, interval: 7200000 }, // 2 hours
  { minScore: 71, maxScore: 90, syncsPerDay: 24, interval: 3600000 }, // 1 hour
  { minScore: 91, maxScore: 100, syncsPerDay: 48, interval: 1800000 }, // 30 minutes
  { minScore: 101, maxScore: 999, syncsPerDay: 60, interval: 1440000 }, // 24 minutes (max)
] as const;

/**
 * Track user activity and update sync profile
 */
export const trackActivity = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    activityType: v.union(
      v.literal("login"),
      v.literal("dashboard"),
      v.literal("widget"),
      v.literal("report"),
      v.literal("api"),
      v.literal("export"),
      v.literal("settings"),
    ),
    metadata: v.optional(v.object({})),
  },
  returns: v.object({
    newScore: v.number(),
    newInterval: v.number(),
    syncsPerDay: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const weight = ACTIVITY_WEIGHTS[args.activityType];

    // Get or create sync profile
    let profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    if (!profile) {
      // Create new profile with defaults
      const profileId = await ctx.db.insert("syncProfiles", {
        organizationId: args.organizationId as Id<"organizations">,
        activityScore: 0,
        lastActivityAt: now,
        activityHistory: [],
        syncFrequency: 1,
        syncInterval: 86400000, // Start with daily
        syncTier: "minimal",
        lastSync: undefined,
        nextScheduledSync: now + 3600000, // First sync in 1 hour
        businessHoursEnabled: true,
        timezone: undefined,
        platformSettings: undefined,
        createdAt: now,
        updatedAt: now,
      });

      profile = await ctx.db.get(profileId);
    }

    if (!profile) {
      throw new Error("Profile not found after creation");
    }

    // Calculate decay for old activity (reduce score over time)
    const hoursSinceLastActivity = profile.lastActivityAt
      ? (now - profile.lastActivityAt) / 3600000
      : 0;
    const decayFactor = Math.max(0.5, 1 - hoursSinceLastActivity * 0.02); // 2% decay per hour

    // Update activity score with decay and new activity
    const decayedScore = profile.activityScore * decayFactor;
    const newScore = Math.min(150, decayedScore + weight); // Cap at 150

    // Find appropriate sync tier
    const tier =
      SYNC_TIERS.find(
        (t) => newScore >= t.minScore && newScore <= t.maxScore,
      ) || SYNC_TIERS[0];

    // Update profile
    await ctx.db.patch(profile._id, {
      activityScore: newScore,
      lastActivityAt: now,
      syncFrequency: tier.syncsPerDay,
      syncInterval: tier.interval,
      syncTier: getTierName(tier),
      updatedAt: now,
    });

    return {
      newScore,
      newInterval: tier.interval,
      syncsPerDay: tier.syncsPerDay,
    };
  },
});

/**
 * Get optimal sync frequency for an organization
 */
export const getSyncFrequency = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    interval: v.number(), // Milliseconds between syncs
    priority: v.number(), // Job priority (1-10)
    nextSyncAt: v.number(), // Next scheduled sync timestamp
    isBusinessHours: v.boolean(), // Whether it's business hours
  }),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    if (!profile) {
      // Default for new organizations
      return {
        interval: 86400000, // 24 hours
        priority: 5,
        nextSyncAt: Date.now() + 3600000, // 1 hour from now
        isBusinessHours: isBusinessHours(),
      };
    }

    // Calculate priority based on activity and time
    const priority = calculatePriority(profile);

    // Adjust interval for business hours
    const adjustedInterval = adjustIntervalForBusinessHours(
      profile.syncInterval,
    );

    return {
      interval: adjustedInterval,
      priority,
      nextSyncAt:
        profile.nextScheduledSync || Date.now() + profile.syncInterval,
      isBusinessHours: isBusinessHours(),
    };
  },
});

/**
 * Update sync metrics after a sync completes
 */
export const updateSyncMetrics = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    duration: v.number(),
    dataChanged: v.boolean(),
    success: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    if (!profile) return;

    // These metrics are now tracked in syncHistory table, not in profile
    // For now, just update basic sync tracking

    await ctx.db.patch(profile._id, {
      lastSync: Date.now(),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Reset daily sync credits (run at midnight)
 */
// Removed daily credit logic — system runs on interval-based scheduling only.

// Helper functions

function getTierName(tier: (typeof SYNC_TIERS)[number]): string {
  if (tier.syncsPerDay <= 1) return "minimal";
  if (tier.syncsPerDay <= 8) return "low";
  if (tier.syncsPerDay <= 24) return "medium";
  if (tier.syncsPerDay <= 48) return "high";

  return "maximum";
}

function isBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Monday-Friday, 8am-7pm (extended business hours)
  return day >= 1 && day <= 5 && hour >= 8 && hour <= 19;
}

function calculatePriority(profile: Doc<"syncProfiles">): number {
  const basePriority = 5;

  // Higher priority for active users
  if (profile.activityScore > 70) return 8;
  if (profile.activityScore > 40) return 6;

  // Lower priority for inactive users
  if (profile.activityScore < 10) return 3;

  // Boost priority during business hours
  if (isBusinessHours()) return basePriority + 1;

  return basePriority;
}

function adjustIntervalForBusinessHours(baseInterval: number): number {
  if (!isBusinessHours()) {
    // Double interval during off-hours
    return baseInterval * 2;
  }

  const hour = new Date().getHours();

  // Peak hours (9-11am, 2-4pm) - more frequent syncs
  if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) {
    return baseInterval * 0.75;
  }

  return baseInterval;
}
