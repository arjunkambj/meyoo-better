import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

import { createJob, type JobType, type SyncJobData } from "./workpool";

type Platform = "shopify" | "meta";
type ScheduleNextResult = {
  scheduled: boolean;
  nextSyncAt: number;
  platforms: string[];
};

/**
 * Schedule the next sync window for an organization. Only the Meta platform is
 * auto-scheduled; Shopify primarily relies on webhook-driven updates.
 */
export const scheduleNext = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.optional(
      v.array(v.union(v.literal("shopify"), v.literal("meta"))),
    ),
  },
  returns: v.object({
    scheduled: v.boolean(),
    nextSyncAt: v.number(),
    platforms: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<ScheduleNextResult> => {
    let platformsToSync = args.platforms as Platform[] | undefined;

    if (!platformsToSync) {
      const metaSession = await ctx.runQuery(
        (internal.integrations.tokenManager as any).getActiveSessionInternal,
        {
          organizationId: args.organizationId,
          platform: "meta",
        },
      );

      if (metaSession) {
        platformsToSync = ["meta"];
      } else {
        return { scheduled: false, nextSyncAt: Date.now(), platforms: [] };
      }
    }

    const primaryPlatform = platformsToSync[0];
    if (!primaryPlatform) {
      return { scheduled: false, nextSyncAt: Date.now(), platforms: [] };
    }

    const frequency = (await ctx.runQuery(
      internal.engine.profiler.getSyncFrequency,
      { organizationId: args.organizationId },
    )) as {
      nextSyncAt: number;
      priority: number;
      interval: number;
      isBusinessHours: boolean;
    };

    const activeSession = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("platform", primaryPlatform)
          .eq("status", "syncing"),
      )
      .first();

    if (activeSession) {
      return {
        scheduled: false,
        nextSyncAt: frequency.nextSyncAt,
        platforms: [],
      };
    }

    const nextSyncTime = calculateOptimalSyncTime(frequency);

    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    const now = Date.now();
    if (
      profile?.nextScheduledSync &&
      profile.nextScheduledSync > now &&
      profile.nextScheduledSync <= now + 30_000
    ) {
      return {
        scheduled: false,
        nextSyncAt: profile.nextScheduledSync,
        platforms: Array.from(platformsToSync),
      };
    }

    if (profile) {
      await ctx.db.patch(profile._id, {
        nextScheduledSync: nextSyncTime,
        updatedAt: now,
      });
    }

    const syncData: SyncJobData = {
      organizationId: args.organizationId as Id<"organizations">,
      platform: primaryPlatform,
      syncType: "incremental",
    };

    await createJob(
      ctx,
      "sync:scheduled" as JobType,
      frequency.priority,
      syncData,
      { runAt: nextSyncTime },
    );

    return {
      scheduled: true,
      nextSyncAt: nextSyncTime,
      platforms: Array.from(platformsToSync),
    };
  },
});

function calculateOptimalSyncTime(frequency: {
  interval: number;
  isBusinessHours: boolean;
}): number {
  const now = Date.now();
  const baseTime = now + frequency.interval;

  if (!frequency.isBusinessHours) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    if (baseTime < tomorrow.getTime()) {
      return tomorrow.getTime();
    }
  }

  const jitter = (Math.random() - 0.5) * 0.2 * frequency.interval;
  return Math.floor(baseTime + jitter);
}
