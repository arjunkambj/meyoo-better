import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { storeAdAccounts, storeCampaigns, storeInsights } from "./storage";
import type { MetaAdAccount, MetaInsight } from "./types";

const ANALYTICS_REBUILD_DEBOUNCE_MS = 10_000;

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

export const getLastSyncTimeInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const lastSyncSession = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("platform", "meta"),
      )
      .order("desc")
      .first();

    const timestamp = lastSyncSession?.completedAt ?? lastSyncSession?.startedAt;

    return timestamp
      ? new Date(timestamp).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  },
});

export const getStoredAdAccountsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("metaAdAccounts"),
      organizationId: v.id("organizations"),
      accountId: v.string(),
      accountName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const primary = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization_and_isPrimary", (q) =>
        q.eq("organizationId", args.organizationId).eq("isPrimary", true),
      )
      .first();

    if (primary) {
      return [
        {
          _id: primary._id as Id<"metaAdAccounts">,
          organizationId: primary.organizationId as Id<"organizations">,
          accountId: primary.accountId,
          accountName: primary.accountName,
        },
      ];
    }

    const fallback = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    return fallback
      ? [
          {
            _id: fallback._id as Id<"metaAdAccounts">,
            organizationId: fallback.organizationId as Id<"organizations">,
            accountId: fallback.accountId,
            accountName: fallback.accountName,
          },
        ]
      : [];
  },
});

export const getAccountTimezoneInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      timezone: v.optional(v.string()),
      timezoneOffsetHours: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_account_org", (q) =>
        q.eq("accountId", args.accountId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!account) return null;

    return {
      timezone: account.timezone ?? undefined,
      timezoneOffsetHours: account.timezoneOffsetHours ?? undefined,
    };
  },
});

export const storeAdAccountsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accounts: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await storeAdAccounts(
      ctx,
      args.organizationId,
      args.accounts as MetaAdAccount[],
    );
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
  handler: async (ctx, args) => {
    await storeCampaigns(
      ctx,
      args.organizationId,
      args.accountId,
      args.campaigns,
    );
    return null;
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
    const normalizedDates = await storeInsights(
      ctx,
      args.organizationId,
      args.accountId,
      args.insights as MetaInsight[],
    );

    if (normalizedDates.size > 0) {
      await ctx.runMutation(
        internal.engine.analytics.enqueueDailyRebuildRequests,
        {
          organizationId: args.organizationId,
          dates: Array.from(normalizedDates),
          debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
          scope: "metaInsights.storeInsights",
        },
      );
    }

    return null;
  },
});

export const getIntegrationSession = internalQuery({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("platform", "meta")
          .eq("isActive", true),
      )
      .first();
  },
});
