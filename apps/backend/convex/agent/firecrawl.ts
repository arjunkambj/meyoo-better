import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getOnboardingForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    return await ctx.db
      .query("onboarding")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
  },
});

export const markFirecrawlSeeded = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
    url: v.string(),
    summary: v.string(),
    pageCount: v.number(),
  },
  handler: async (ctx, { onboardingId, url, summary, pageCount }) => {
    const existing = await ctx.db.get(onboardingId);
    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...(existing?.onboardingData || {}),
        firecrawlSeededAt: new Date().toISOString(),
        firecrawlSeededUrl: url,
        firecrawlSummary: summary,
        firecrawlPageCount: pageCount,
        firecrawlSeedingStatus: undefined,
      },
      updatedAt: Date.now(),
    });
  },
});

export const markFirecrawlSeedingInProgress = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
  },
  handler: async (ctx, { onboardingId }) => {
    const existing = await ctx.db.get(onboardingId);
    if (!existing) return;

    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...(existing.onboardingData || {}),
        firecrawlSeedingStatus: {
          status: "in_progress",
          startedAt: Date.now(),
        },
        firecrawlLastAttemptAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

export const markFirecrawlSeedingScheduled = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
    retryAt: v.number(),
  },
  handler: async (ctx, { onboardingId, retryAt }) => {
    const existing = await ctx.db.get(onboardingId);
    if (!existing) return;

    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...(existing.onboardingData || {}),
        firecrawlSeedingStatus: {
          status: "scheduled",
          retryAt,
        },
      },
      updatedAt: Date.now(),
    });
  },
});

export const clearFirecrawlSeedingStatus = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
  },
  handler: async (ctx, { onboardingId }) => {
    const existing = await ctx.db.get(onboardingId);
    if (!existing) return;

    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...(existing.onboardingData || {}),
        firecrawlSeedingStatus: undefined,
      },
      updatedAt: Date.now(),
    });
  },
});
