import { v } from "convex/values";

import { createSimpleLogger } from "../../libs/logging/simple";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import { normalizeDateString } from "../utils/date";

const logger = createSimpleLogger("MetaInternal");
const ANALYTICS_REBUILD_DEBOUNCE_MS = 10_000;

/**
 * Meta internal queries and mutations
 */

export const getActiveSessionInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("platform", "meta")
          .eq("isActive", true),
      )
      .first();

    if (!session) return null;

    // Get the primary ad account
    const primaryAccount = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization_and_isPrimary", (q) =>
        q.eq("organizationId", args.organizationId).eq("isPrimary", true),
      )
      .first();

    return {
      ...session,
      primaryAccountId: primaryAccount?.accountId,
    };
  },
});

export const storeInsightsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.string(),
    insights: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affectedDates = new Set<string>();
    for (const insight of args.insights) {
      // Check if insight for this date already exists
      const existing = await ctx.db
        .query("metaInsights")
        .withIndex("by_entity_date", (q) =>
          q
            .eq("entityType", insight.entityType)
            .eq("entityId", insight.entityId)
            .eq("date", insight.date),
        )
        .first();

      if (existing) {
        // Update existing record
        await ctx.db.patch(existing._id, insight);
      } else {
        // Insert new record
        await ctx.db.insert("metaInsights", insight);
      }

      const rawDate = typeof insight.date === "string"
        ? insight.date
        : typeof insight.date_start === "string"
          ? insight.date_start
          : undefined;
      if (rawDate) {
        try {
          const normalized = normalizeDateString(rawDate);
          affectedDates.add(normalized);
        } catch (_error) {
          // Ignore invalid dates
        }
      }
    }

    if (affectedDates.size > 0) {
      const dates = Array.from(affectedDates);
      await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
        organizationId: args.organizationId,
        dates,
        debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
        scope: "metaInsights.storeInsights",
      });
    }

    return null;
  },
});

export const storeCampaignsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.string(),
    campaigns: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    // For now, we can store campaigns in a simple format
    // In the future, we might want to create a metaCampaigns table
    logger.debug("Storing campaigns", {
      count: args.campaigns.length,
      accountId: args.accountId,
    });

    // You could store these in a campaigns table if needed
    // For now, just log them
    return null;
  },
});
