import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";

import { createJob, PRIORITY } from "./workpool";

/**
 * Trigger an initial sync job for a platform
 */
export const triggerInitialSync = mutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    dateRange: v.optional(
      v.object({
        daysBack: v.number(),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    jobId: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    // Verify the user has access to this organization
    if (user.organizationId !== args.organizationId) {
      throw new Error(
        "Unauthorized: Cannot trigger sync for this organization",
      );
    }

    try {
      // Create the sync job with onComplete callback
      const jobId = await createJob(
        ctx,
        "sync:initial",
        PRIORITY.HIGH,
        {
          organizationId: args.organizationId,
          platform: args.platform,
          dateRange: args.dateRange || { daysBack: 60 },
        },
        {
          onComplete: internal.engine.syncJobs.onInitialSyncComplete as any,
          context: {
            organizationId: args.organizationId,
            platform: args.platform,
          },
        },
      );

      // production: avoid verbose sync job creation logs

      return {
        success: true,
        jobId,
      };
    } catch (error) {
      console.error(
        `[SYNC] Failed to create initial sync job for ${args.platform}`,
        error,
      );
      throw error;
    }
  },
});

/**
 * Internal function to trigger initial sync (bypasses auth)
 * Used by installation flow where user is not yet fully set up
 */
export const triggerInitialSyncInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    dateRange: v.optional(
      v.object({
        daysBack: v.number(),
      }),
    ),
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    jobId: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Create the sync job with onComplete callback
      const jobId = await createJob(
        ctx,
        "sync:initial",
        PRIORITY.HIGH,
        {
          organizationId: args.organizationId,
          platform: args.platform,
          dateRange: args.dateRange || { daysBack: 60 },
        },
        {
          onComplete: internal.engine.analytics.calculate as any,
          context: {
            organizationId: args.organizationId,
            platform: args.platform,
          },
        },
      );

      // production: avoid verbose sync job creation logs

      return {
        success: true,
        jobId,
      };
    } catch (error) {
      console.error(
        `[SYNC] Failed to create initial sync job for ${args.platform}`,
        error,
      );
      throw error;
    }
  },
});

/**
 * Trigger sync after Meta account selection
 */
export const triggerAccountSync = mutation({
  args: {
    platform: v.literal("meta"),
    accountId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    jobId: v.string(),
    skipped: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    // Check if this specific account already has recent data
    if (args.platform === "meta") {
      const metaAccount = await ctx.db
        .query("metaAdAccounts")
        .withIndex("by_account_org", (q) =>
          q
            .eq("accountId", args.accountId)
            .eq("organizationId", user.organizationId as Id<"organizations">),
        )
        .first();

      if (metaAccount?.syncedAt) {
        const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour threshold for onboarding

        if (metaAccount.syncedAt > oneHourAgo) {
          return {
            success: true,
            jobId: "skipped",
            skipped: true,
            reason: "Account was synced recently",
          };
        }
      }
    }

    // Check for recent manual syncs (5-second debounce)
    const fiveSecondsAgo = Date.now() - 5000;
    const recentSync = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .order("desc")
      .first();

    if (recentSync && recentSync.startedAt > fiveSecondsAgo) {
      return {
        success: true,
        jobId: recentSync._id, // Return existing job ID
      };
    }

    try {
      // Create the sync job with onComplete callback
      const jobId = await createJob(
        ctx,
        "sync:initial",
        PRIORITY.HIGH,
        {
          organizationId: user.organizationId,
          platform: args.platform,
          accountId: args.accountId,
          dateRange: { daysBack: 60 },
        },
        {
          onComplete: internal.engine.syncJobs.onInitialSyncComplete as any,
          context: {
            organizationId: user.organizationId,
            platform: args.platform,
          },
        },
      );

      // production: avoid verbose sync job creation logs

      return {
        success: true,
        jobId,
      };
    } catch (error) {
      console.error(
        `[SYNC] Failed to create ${args.platform} sync job for account ${args.accountId}`,
        error,
      );
      throw error;
    }
  },
});

/**
 * Helper function to get connected platforms for an organization
 */
async function getConnectedPlatforms(
  ctx: GenericMutationCtx<DataModel>,
  organizationId: Id<"organizations">,
): Promise<string[]> {
  const platforms: string[] = [];

  // Check Shopify
  const shopifyStore = await ctx.db
    .query("shopifyStores")
    .withIndex("by_organization_and_active", (q) =>
      q.eq("organizationId", organizationId).eq("isActive", true),
    )
    .first();

  if (shopifyStore) platforms.push("shopify");

  // Check Meta
  const metaSession = await ctx.db
    .query("integrationSessions")
    .withIndex("by_org_platform_and_status", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("platform", "meta")
        .eq("isActive", true),
    )
    .first();

  if (metaSession) platforms.push("meta");

  return platforms;
}

/**
 * Called when an initial sync completes
 * Checks if all platform syncs are done and triggers analytics
 */
export const onInitialSyncComplete = internalMutation({
  args: {
    workId: v.string(),
    context: v.object({
      organizationId: v.id("organizations"),
      platform: v.string(),
      sessionId: v.optional(v.id("syncSessions")),
    }),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const { organizationId } = args.context;

    // production: avoid verbose sync tracker logs

    // Get all connected platforms
    const connectedPlatforms = await getConnectedPlatforms(ctx, organizationId);

    // Check each platform's initial sync status using indexes (NO FILTER!)
    const completedPlatforms: string[] = [];

    for (const plat of connectedPlatforms) {
      // Use the compound index to check if this platform has completed initial sync
      const syncs = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("platform", plat as "shopify" | "meta")
            .eq("status", "completed"),
        )
        .collect();

      // Filter for initial sync type in memory
      const completedSync = syncs.find((s) => s.type === "initial");

      if (completedSync) {
        completedPlatforms.push(plat);
      }
    }

    // Check if all connected platforms have completed
    const allCompleted =
      completedPlatforms.length === connectedPlatforms.length;

    // production: avoid verbose sync tracker logs

    if (allCompleted && connectedPlatforms.length > 0) {
      // production: avoid verbose sync tracker logs

      // Check if user has completed onboarding
      const user = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .first();

      // If user is still in onboarding, don't trigger analytics yet
      // Analytics will be triggered when onboarding completes
      if (!user?.isOnboarded) {
        // production: avoid verbose sync tracker logs

        return;
      }

      // User has completed onboarding, proceed with analytics
      // production: avoid verbose sync tracker logs

      // Determine if any costs exist for analytics
      const hasAnyCosts = (await ctx.db
        .query("costs")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .first())
        ? true
        : false;

      // Trigger analytics with cost information
      await createJob(ctx, "analytics:calculate", PRIORITY.HIGH, {
        organizationId,
        syncType: "initial",
        hasHistoricalCosts: hasAnyCosts,
        calculateProfits: hasAnyCosts,
      });

      // production: avoid verbose sync tracker logs
    }
  },
});
