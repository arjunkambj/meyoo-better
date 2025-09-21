import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
} from "../_generated/server";

import {
  createJob,
  type JobType,
  PRIORITY,
  type SyncJobData,
} from "./workpool";

/**
 * Schedule the next sync based on activity profile
 */
export const scheduleNext = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.optional(
      v.array(v.union(v.literal("shopify"), v.literal("meta"))),
    ), // If not provided, sync both
  },
  returns: v.object({
    scheduled: v.boolean(),
    nextSyncAt: v.number(),
    platforms: v.array(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    scheduled: boolean;
    nextSyncAt: number;
    platforms: string[];
  }> => {
    // Get sync frequency from profiler
    interface SyncFrequency {
      nextSyncAt: number;
      priority: number;
      interval: number;
      isBusinessHours: boolean;
    }
    const frequency = (await ctx.runQuery(
      internal.engine.profiler.getSyncFrequency,
      {
        organizationId: args.organizationId,
      },
    )) as SyncFrequency;

    // No credit gating; interval + presence rules govern scheduling

    // Determine which platforms to sync
    // If none provided, only schedule Meta when an active Meta integration exists for this org.
    let platformsToSync = args.platforms || undefined;
    if (!platformsToSync) {
      const metaSession = await ctx.runQuery(
        (internal.integrations.tokenManager as any).getActiveSessionInternal,
        {
          organizationId: args.organizationId,
          platform: "meta",
        },
      );
      if (metaSession) {
        platformsToSync = ["meta"] as ("shopify" | "meta")[];
      } else {
        return {
          scheduled: false,
          nextSyncAt: Date.now(),
          platforms: [],
        };
      }
    }

    // Avoid enqueuing when a session is already pending/running for the first platform
    const active = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq(
            "platform",
            (platformsToSync[0] as unknown as "shopify" | "meta")
          )
          .eq("status", "syncing"),
      )
      .first();
    if (active) {
      return {
        scheduled: false,
        nextSyncAt: frequency.nextSyncAt,
        platforms: [],
      };
    }

    // Calculate optimal next sync time
    const nextSyncTime = calculateOptimalSyncTime(frequency);

    // Check existing profile to avoid duplicate enqueue and minimize conflicts
    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    const now = Date.now();
    // If there is already a future sync scheduled soon, skip scheduling
    // "Soon" means within the next 30 seconds. The previous condition
    // incorrectly skipped only when the next sync was far in the future,
    // which caused duplicate near-term enqueues.
    if (
      profile?.nextScheduledSync &&
      profile.nextScheduledSync > now &&
      profile.nextScheduledSync <= now + 30_000
    ) {
      return {
        scheduled: false,
        nextSyncAt: profile.nextScheduledSync,
        platforms: platformsToSync,
      };
    }

    // Update next sync time in profile before enqueueing to prevent duplicate logs on retries
    if (profile) {
      await ctx.db.patch(profile._id, {
        nextScheduledSync: nextSyncTime,
        updatedAt: now,
      });
    }

    // Schedule the sync job (single platform at a time)
    const syncData: SyncJobData = {
      organizationId: args.organizationId as Id<"organizations">,
      platform: platformsToSync[0] as "shopify" | "meta",
      syncType: "incremental",
    };
    await createJob(
      ctx,
      "sync:scheduled" as JobType,
      frequency.priority,
      syncData,
      {
        runAt: nextSyncTime,
      },
    );

    return {
      scheduled: true,
      nextSyncAt: nextSyncTime,
      platforms: platformsToSync,
    };
  },
});

/**
 * Trigger immediate sync on user action (with debouncing)
 */
export const triggerImmediate = mutation({
  args: {
    platform: v.optional(v.union(v.literal("shopify"), v.literal("meta"))),
  },
  returns: v.object({
    triggered: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async () => ({ triggered: false, reason: "Manual sync disabled" }),
});

/**
 * Schedule initial sync during onboarding (60 days of data)
 */
export const scheduleInitialSync = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.array(v.union(v.literal("shopify"), v.literal("meta"))),
  },
  returns: v.object({
    scheduled: v.boolean(),
    jobIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const jobIds: string[] = [];

    // Schedule high-priority initial sync for each platform
    for (const platform of args.platforms) {
      const syncData: SyncJobData = {
        organizationId: args.organizationId as Id<"organizations">,
        platform: platform as "shopify" | "meta",
        syncType: "initial",
        dateRange: { daysBack: 60 },
      };
      const jobId = await createJob(
        ctx,
        "sync:initial" as JobType,
        PRIORITY.HIGH,
        syncData,
      );

      jobIds.push(jobId);
    }

    // Create sync profile for new organization
    await ctx.db.insert("syncProfiles", {
      organizationId: args.organizationId as Id<"organizations">,
      activityScore: 20, // Start with moderate activity score
      lastActivityAt: Date.now(),
      activityHistory: [],
      syncFrequency: 4, // Start with 4 syncs per day
      syncInterval: 21600000, // Start with 6-hour intervals
      syncTier: "low",
      lastSync: undefined,
      nextScheduledSync: Date.now() + 3600000, // Next sync in 1 hour
      businessHoursEnabled: true,
      timezone: undefined,
      platformSettings: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      scheduled: true,
      jobIds,
    };
  },
});

/**
 * Run hourly check for organizations that need syncing
 */
export const runHourlyCheck = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();

    // Find profiles that are due for sync
    const profiles = await ctx.db
      .query("syncProfiles")
      .withIndex("by_next_sync", (q) => q.lte("nextScheduledSync", now))
      .collect();

    // production: avoid noisy logs for hourly checks

    for (const profile of profiles) {
      // No credit gating

      // Skip if a sync is in-flight (cost-efficient)
      const inFlight = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", profile.organizationId)
            .eq("platform", "shopify")
            .eq("status", "syncing"),
        )
        .first();
      if (inFlight) continue;

      // Create the job directly instead of calling scheduleNext to avoid circular dependency
      const syncData: SyncJobData = {
        organizationId: profile.organizationId,
        platform: "shopify",
        syncType: "incremental",
      };
      await createJob(
        ctx,
        "sync:scheduled" as JobType,
        PRIORITY.NORMAL,
        syncData,
        {
          runAt: Date.now() + profile.syncInterval,
        },
      );

      // Update next sync time
      await ctx.db.patch(profile._id, {
        nextScheduledSync: Date.now() + profile.syncInterval,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Sweep organizations that are online; if last sync > 10m, schedule incremental syncs.
 * Meta only by default; Shopify relies on webhooks.
 */

/**
 * Twice-daily Shopify reconciliation: enqueue a small incremental job.
 * While webhooks keep data live, this catches missed events.
 */
// Shopify reconcile removed: Shopify is fully webhook-driven now

/**
 * Get last sync time for an organization/platform
 */
export const getLastSyncTime = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    platform: v.optional(v.union(v.literal("shopify"), v.literal("meta"))),
  },
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args) => {
    const lastSyncSession = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("platform", args.platform || "shopify"),
      )
      .order("desc")
      .first();

    if (!lastSyncSession) return null;

    // Prefer the completion timestamp; fall back to when the sync started
    return lastSyncSession.completedAt ?? lastSyncSession.startedAt;
  },
});

/**
 * Schedule sync for organization (exported for admin API)
 */
export const scheduleSync = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.optional(
      v.array(v.union(v.literal("shopify"), v.literal("meta"))),
    ),
    priority: v.optional(v.number()),
  },
  returns: v.object({
    scheduled: v.boolean(),
    jobIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const platformsToSync = args.platforms || ["shopify", "meta"];
    const priority = args.priority || PRIORITY.HIGH;

    const jobIds: string[] = [];

    for (const platform of platformsToSync) {
      const syncData: SyncJobData = {
        organizationId: args.organizationId as Id<"organizations">,
        platform: platform as "shopify" | "meta",
        syncType: "incremental",
      };
      const jobId = await createJob(
        ctx,
        "sync:manual" as JobType,
        priority,
        syncData,
      );

      jobIds.push(jobId);
    }

    return {
      scheduled: true,
      jobIds,
    };
  },
});

/**
 * Calculate optimal sync time based on various factors
 */
function calculateOptimalSyncTime(frequency: {
  interval: number;
  isBusinessHours: boolean;
}): number {
  const now = Date.now();
  const baseTime = now + frequency.interval;

  // If not business hours, delay to next business day
  if (!frequency.isBusinessHours) {
    const tomorrow9am = new Date();

    tomorrow9am.setDate(tomorrow9am.getDate() + 1);
    tomorrow9am.setHours(9, 0, 0, 0);

    // If next sync would be before 9am tomorrow, delay it
    if (baseTime < tomorrow9am.getTime()) {
      return tomorrow9am.getTime();
    }
  }

  // Add some randomization to spread load (±10% of interval)
  const jitter = (Math.random() - 0.5) * 0.2 * frequency.interval;

  return Math.floor(baseTime + jitter);
}

/**
 * Pause syncing for an organization
 */
export const pauseSyncing = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        nextScheduledSync: Number.MAX_SAFE_INTEGER, // Far future
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Resume syncing for an organization
 */
export const resumeSyncing = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        nextScheduledSync: Date.now() + 60000, // Sync in 1 minute
        updatedAt: Date.now(),
      });

      // Create sync job directly
      const syncData: SyncJobData = {
        organizationId: args.organizationId as Id<"organizations">,
        platform: "shopify",
        syncType: "incremental",
      };
      await createJob(
        ctx,
        "sync:immediate" as JobType,
        PRIORITY.HIGH,
        syncData,
      );
    }

    return null;
  },
});
