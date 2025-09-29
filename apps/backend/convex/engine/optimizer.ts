import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Cost tracking for API calls
 */
const API_COSTS = {
  shopify: 0, // Free with app
  meta: 0.0001, // Estimated cost per API call
} as const;

/**
 * Optimize sync frequency based on data change patterns
 */
export const optimizeSyncFrequency = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    currentInterval: v.number(),
    recommendedInterval: v.number(),
    reason: v.string(),
    shouldOptimize: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Smart Adaptive Sync Engine - Planned for launch
    // For now, return default values
    // TODO: Implement when syncProfiles table is added

    // Get recent sync history
    const recentSyncs = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(20);

    // Analyze patterns
    const analysis = analyzeDataChangePatterns(recentSyncs);

    // Default sync interval (1 hour) - will be dynamic when sync profiles are added
    const currentInterval = 3600000; // 1 hour default
    let recommendedInterval = currentInterval;
    let reason = "No change recommended";

    // If data rarely changes, increase interval
    if (analysis.changeRate < 0.1) {
      recommendedInterval = Math.min(86400000, currentInterval * 2); // Max 24 hours
      reason = "Data changes infrequently (< 10% of syncs)";
    }
    // If data changes frequently during specific hours, optimize for those
    else if (analysis.peakHours.length > 0) {
      const currentHour = new Date().getHours();

      if (analysis.peakHours.includes(currentHour)) {
        recommendedInterval = Math.max(1800000, currentInterval * 0.5); // Min 30 minutes
        reason = `Peak activity hour (${currentHour}:00)`;
      } else {
        recommendedInterval = Math.min(14400000, currentInterval * 1.5); // Max 4 hours off-peak
        reason = "Off-peak hours";
      }
    }
    // If high failure rate, back off
    else if (analysis.failureRate > 0.3) {
      recommendedInterval = Math.min(86400000, currentInterval * 3);
      reason = "High failure rate - backing off";
    }

    // TODO: Update sync profile when table is added to schema
    // For now, just return the recommendation

    return {
      currentInterval,
      recommendedInterval,
      reason,
      shouldOptimize: Math.abs(recommendedInterval - currentInterval) > 600000,
    };
  },
});

/**
 * Get cost analysis for syncing
 */
export const getCostAnalysis = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
  },
  returns: v.object({
    totalCost: v.number(),
    costByPlatform: v.object({
      shopify: v.number(),
      meta: v.number(),
    }),
    apiCallsByPlatform: v.object({
      shopify: v.number(),
      meta: v.number(),
    }),
    recommendations: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get sync history for date range
    const startTime = new Date(args.dateRange.startDate).getTime();
    const endTime = new Date(args.dateRange.endDate).getTime();

    // Use index for efficient date filtering - note: we can't use the full index
    // by_org_platform_and_date because we want all platforms, so we fetch all and filter
    const syncs = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    // Filter by date range in JavaScript (optimal given we need all platforms)
    const filteredSyncs = syncs.filter(
      (s) => s.startedAt >= startTime && s.startedAt <= endTime,
    );

    // Calculate costs
    const costs = {
      shopify: 0,
      meta: 0,
    };

    const apiCalls = {
      shopify: 0,
      meta: 0,
    };

    for (const sync of filteredSyncs) {
      const platform = sync.platform as keyof typeof costs;
      // TODO: Track API calls in syncSessions for accurate cost tracking
      const calls = 100; // Default estimate until we track actual API calls

      apiCalls[platform] += calls;
      costs[platform] += calls * API_COSTS[platform];
    }

    // Generate recommendations
    const recommendations = [];

    if (apiCalls.meta > 10000) {
      recommendations.push(
        "High Meta API usage - consider reducing sync frequency",
      );
    }

    const totalCalls = apiCalls.shopify + apiCalls.meta;

    if (totalCalls > 150000) {
      recommendations.push(
        "Consider upgrading to a higher API tier for better limits",
      );
    }

    return {
      totalCost: costs.shopify + costs.meta,
      costByPlatform: costs,
      apiCallsByPlatform: apiCalls,
      recommendations,
    };
  },
});

/**
 * Predict optimal sync times based on historical patterns
 */
export const predictOptimalSyncTimes = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    optimalTimes: v.array(v.number()), // Hours of day (0-23)
    reasoning: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get sync history
    const history = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(100);

    // Analyze when data changes occur
    const changesByHour: Record<number, number> = {};
    const syncsByHour: Record<number, number> = {};

    for (const sync of history) {
      const hour = new Date(sync.startedAt).getHours();

      syncsByHour[hour] = (syncsByHour[hour] || 0) + 1;

      if (sync.recordsProcessed && sync.recordsProcessed > 0) {
        changesByHour[hour] = (changesByHour[hour] || 0) + 1;
      }
    }

    // Calculate change rate by hour
    const changeRateByHour: Record<number, number> = {};

    for (let hour = 0; hour < 24; hour++) {
      const denom = syncsByHour[hour] ?? 0;
      changeRateByHour[hour] = denom > 0 ? (changesByHour[hour] || 0) / denom : 0;
    }

    // Find hours with highest change rate
    const sortedHours = Object.entries(changeRateByHour)
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
      .map(([hour]) => parseInt(hour, 10));

    // Select top hours with significant activity
    const optimalTimes = sortedHours
      .filter((hour) => (changeRateByHour[hour] ?? 0) > 0.2) // At least 20% change rate
      .slice(0, 6); // Max 6 optimal times per day

    // Add default times if not enough data
    if (optimalTimes.length < 3) {
      optimalTimes.push(9, 14, 18); // Morning, afternoon, evening
    }

    return {
      optimalTimes: optimalTimes.sort((a, b) => a - b),
      reasoning:
        optimalTimes.length > 0
          ? `Based on ${history.length} syncs, data changes most frequently at these hours`
          : "Insufficient data - using default business hours",
    };
  },
});

/**
 * Analyze data change patterns
 */
function analyzeDataChangePatterns(syncs: Doc<"syncSessions">[]) {
  if (syncs.length === 0) {
    return {
      changeRate: 0,
      peakHours: [],
      avgDuration: 0,
      failureRate: 0,
    };
  }

  const changedSyncs = syncs.filter(
    (s) => s.recordsProcessed && s.recordsProcessed > 0,
  );
  const changeRate = changedSyncs.length / syncs.length;
  const failedSyncs = syncs.filter((s) => s.status === "failed");
  const failureRate = failedSyncs.length / syncs.length;

  // Find peak hours
  const changesByHour: Record<number, number> = {};

  for (const sync of changedSyncs) {
    const hour = new Date(sync.startedAt).getHours();

    changesByHour[hour] = (changesByHour[hour] || 0) + 1;
  }

  // Get hours with above-average changes
  const avgChangesPerHour = changedSyncs.length / 24;
  const peakHours = Object.entries(changesByHour)
    .filter(([, count]) => count > avgChangesPerHour)
    .map(([hour]) => parseInt(hour, 10));

  // Calculate average duration
  const totalDuration = syncs.reduce((sum, s) => {
    const duration =
      s.completedAt && s.startedAt ? s.completedAt - s.startedAt : 0;
    return sum + duration;
  }, 0);
  const avgDuration = totalDuration / syncs.length;

  return {
    changeRate,
    peakHours,
    avgDuration,
    failureRate,
  };
}

/**
 * Balance sync load across organizations
 */
export const balanceSyncLoad = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Use index to avoid full table scan when fetching scheduled profiles
    const profiles = await ctx.db
      .query("syncProfiles")
      .withIndex("by_next_sync", (q) => q.gt("nextScheduledSync", 0))
      .collect();

    // Group by next sync hour
    const syncsByHour: Record<number, string[]> = {};

    for (const profile of profiles) {
      if (!profile.nextScheduledSync) continue;
      const hour = new Date(profile.nextScheduledSync).getHours();

      if (!syncsByHour[hour]) {
        syncsByHour[hour] = [];
      }
      syncsByHour[hour].push(profile.organizationId);
    }

    // Find overloaded hours (> 10 orgs syncing at same time)
    const overloadedHours = Object.entries(syncsByHour)
      .filter(([, orgs]) => orgs.length > 10)
      .map(([hour]) => parseInt(hour, 10));

    // Redistribute syncs from overloaded hours
    for (const hour of overloadedHours) {
      const orgs = syncsByHour[hour] || [];
      const excessOrgs = orgs.slice(10); // Keep first 10, redistribute rest

      for (let i = 0; i < excessOrgs.length; i++) {
        const profile = profiles.find(
          (p) => p.organizationId === excessOrgs[i],
        );

        if (profile) {
          // Spread to adjacent hours
          const newHour = (hour + (i % 3) - 1 + 24) % 24;
          const newTime = new Date(profile.nextScheduledSync || Date.now());

          newTime.setHours(newHour);

          await ctx.db.patch(profile._id, {
            nextScheduledSync: newTime.getTime(),
            updatedAt: Date.now(),
          });
        }
      }
    }

    return {
      rebalanced: overloadedHours.length > 0,
      affectedHours: overloadedHours,
    };
  },
});

/**
 * Get sync recommendations for an organization
 */
export const getSyncRecommendations = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      type: v.string(),
      recommendation: v.string(),
      impact: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    }),
  ),
  handler: async (ctx, args) => {
    const recommendations: Array<{
      type: string;
      recommendation: string;
      impact: "high" | "medium" | "low";
    }> = [];

    // Get profile and history
    const profile = await ctx.db
      .query("syncProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!profile) return recommendations;

    const recentSyncs = await ctx.db
      .query("syncSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(50);

    // Analyze recent syncs
    const failedSyncs = recentSyncs.filter((s) => s.status === "failed");
    const failureRate =
      recentSyncs.length > 0 ? failedSyncs.length / recentSyncs.length : 0;

    // Check failure rate
    if (failureRate > 0.2) {
      recommendations.push({
        type: "reliability",
        recommendation:
          "High failure rate detected. Check API credentials and rate limits.",
        impact: "high",
      });
    }

    // Check data change rate
    const changedSyncs = recentSyncs.filter(
      (s) => s.recordsProcessed && s.recordsProcessed > 0,
    );
    const changeRate =
      recentSyncs.length > 0 ? changedSyncs.length / recentSyncs.length : 0;

    if (changeRate < 0.05) {
      recommendations.push({
        type: "efficiency",
        recommendation:
          "Data rarely changes. Consider reducing sync frequency to save resources.",
        impact: "medium",
      });
    }

    // Check sync duration
    const completedSyncs = recentSyncs.filter(
      (s) => s.completedAt && s.startedAt,
    );
    const avgDuration =
      completedSyncs.length > 0
        ? completedSyncs.reduce(
            (sum, s) => sum + ((s.completedAt || 0) - s.startedAt),
            0,
          ) / completedSyncs.length
        : 0;

    if (avgDuration > 30000) {
      // > 30 seconds
      recommendations.push({
        type: "performance",
        recommendation:
          "Syncs taking longer than expected. Consider optimizing queries or reducing data scope.",
        impact: "medium",
      });
    }

    // Check activity vs sync frequency
    if (profile.activityScore > 70 && profile.syncInterval > 7200000) {
      // Active but syncing < every 2 hours
      recommendations.push({
        type: "freshness",
        recommendation:
          "High user activity detected. Consider increasing sync frequency for fresher data.",
        impact: "low",
      });
    }

    return recommendations;
  },
});
