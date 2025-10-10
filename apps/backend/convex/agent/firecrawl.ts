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
    const onboardingData = existing?.onboardingData || {};
    const previousStatus = onboardingData.firecrawlSeedingStatus;
    const startedAt =
      typeof previousStatus?.startedAt === "number"
        ? previousStatus.startedAt
        : Date.now();

    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...onboardingData,
        firecrawlSeededAt: new Date().toISOString(),
        firecrawlSeededUrl: url,
        firecrawlSummary: summary,
        firecrawlPageCount: pageCount,
        firecrawlSeedingStatus: {
          status: "completed",
          startedAt,
        },
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

export const markFirecrawlSeedingFailed = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { onboardingId, errorMessage }) => {
    const existing = await ctx.db.get(onboardingId);
    if (!existing) return;

    const onboardingData = existing.onboardingData || {};
    const previousStatus = onboardingData.firecrawlSeedingStatus;
    const startedAt =
      typeof previousStatus?.startedAt === "number"
        ? previousStatus.startedAt
        : Date.now();

    const status: {
      status: "failed";
      startedAt: number;
      retryAt?: number;
      errorMessage?: string;
    } = {
      status: "failed",
      startedAt,
    };

    if (errorMessage) {
      status.errorMessage = errorMessage;
    }

    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...onboardingData,
        firecrawlSeedingStatus: status,
      },
      updatedAt: Date.now(),
    });
  },
});
